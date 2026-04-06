// Reqpane background service worker
// Uses chrome.debugger CDP for network capture (no page-context injection)
// CDP domains used: Network, Fetch, Runtime only (no Runtime.evaluate)

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })

// Re-inject content scripts into existing tabs on install/update
chrome.runtime.onInstalled.addListener(async () => {
  const tabs = await chrome.tabs.query({})
  for (const tab of tabs) {
    if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('edge://') || tab.url.startsWith('chrome-extension://')) {
      continue
    }
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      })
    } catch (err) {
      // Tab might not allow script injection
    }
  }
})

// ========================================
// State
// ========================================

const apiRequests = new Map()    // tabId -> requests[]
const consoleErrors = new Map()  // tabId -> errors[]
const MAX_REQUESTS_PER_TAB = 100
const MAX_ERRORS_PER_TAB = 50
const MAX_RESPONSE_BODY_SIZE = 5 * 1024 * 1024 // 5MB

// CDP state
const debuggerState = new Map()  // tabId -> { attached, fetchEnabled }
const pendingRequests = new Map() // CDP requestId -> partial request data
const mockedNetworkIds = new Set() // networkIds of mocked requests (for dedup)
const pausedRequests = new Map()  // Fetch requestId -> { tabId, request, timeout }
let sidePanelPort = null
let activeTabId = null
let tabSwitchGeneration = 0 // latest-wins guard for tab switches

// ========================================
// URL Pattern Matching
// ========================================

function matchUrlPattern(url, pattern, method) {
  if (method && method !== 'ALL') {
    // method check is handled by caller
  }

  if (pattern.includes('*')) {
    const regex = new RegExp('^' + pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$')
    return regex.test(url)
  }
  return url.includes(pattern)
}

function toCdpPattern(pattern) {
  // Wrap non-wildcard patterns with * to preserve substring matching semantics
  if (!pattern.includes('*')) {
    return `*${pattern}*`
  }
  return pattern
}

// ========================================
// CDP Debugger Lifecycle (Unit 2)
// ========================================

async function attachDebugger(tabId) {
  if (debuggerState.has(tabId) && debuggerState.get(tabId).attached) {
    return true
  }

  try {
    await chrome.debugger.attach({ tabId }, '1.3')
    debuggerState.set(tabId, { attached: true, fetchEnabled: false })

    await chrome.debugger.sendCommand({ tabId }, 'Network.enable', {})
    await chrome.debugger.sendCommand({ tabId }, 'Runtime.enable', {})

    // Enable Fetch domain if rules exist
    await updateFetchPatterns(tabId)

    // Cache page info
    try {
      const tab = await chrome.tabs.get(tabId)
      debuggerState.get(tabId).pageUrl = tab.url || ''
      debuggerState.get(tabId).pageTitle = tab.title || ''
    } catch (e) {}

    notifySidePanel({ type: 'DEBUGGER_STATUS', status: 'attached', tabId })
    return true
  } catch (err) {
    debuggerState.delete(tabId)
    notifySidePanel({ type: 'DEBUGGER_STATUS', status: 'error', tabId, error: err.message })
    return false
  }
}

async function detachDebugger(tabId) {
  const state = debuggerState.get(tabId)
  if (!state?.attached) return

  // Clean up paused requests for this tab
  for (const [reqId, paused] of pausedRequests) {
    if (paused.tabId === tabId) {
      clearTimeout(paused.timeout)
      pausedRequests.delete(reqId)
    }
  }

  try {
    await chrome.debugger.detach({ tabId })
  } catch (e) {
    // Already detached
  }

  debuggerState.delete(tabId)
  // Clean up pending requests for this tab
  for (const [reqId, req] of pendingRequests) {
    if (req._tabId === tabId) {
      pendingRequests.delete(reqId)
    }
  }
}

function notifySidePanel(message) {
  chrome.runtime.sendMessage(message).catch(() => {})
}

// Side panel lifecycle via port
chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'sidepanel') return
  // Verify port is from extension page (not content script)
  if (port.sender?.tab) return

  sidePanelPort = port

  // Attach to active tab
  chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
    if (tabs[0]?.id) {
      activeTabId = tabs[0].id
      await attachDebugger(activeTabId)
    }
  })

  port.onDisconnect.addListener(() => {
    sidePanelPort = null
    if (activeTabId) {
      detachDebugger(activeTabId)
      activeTabId = null
    }
  })
})

// Handle debugger detach events
chrome.debugger.onDetach.addListener((source, reason) => {
  const tabId = source.tabId
  const state = debuggerState.get(tabId)
  if (state) {
    // Clean up paused requests
    for (const [reqId, paused] of pausedRequests) {
      if (paused.tabId === tabId) {
        clearTimeout(paused.timeout)
        pausedRequests.delete(reqId)
      }
    }
    debuggerState.delete(tabId)
  }

  // Clean up pending requests
  for (const [reqId, req] of pendingRequests) {
    if (req._tabId === tabId) {
      pendingRequests.delete(reqId)
    }
  }

  notifySidePanel({ type: 'DEBUGGER_STATUS', status: 'detached', tabId, reason })
})

// Tab switching while side panel is open
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  if (!sidePanelPort) return

  const generation = ++tabSwitchGeneration
  const oldTabId = activeTabId

  if (oldTabId) {
    await detachDebugger(oldTabId)
    if (generation !== tabSwitchGeneration) return // stale switch
  }

  activeTabId = activeInfo.tabId
  if (generation !== tabSwitchGeneration) return

  await attachDebugger(activeTabId)
})

// ========================================
// CDP Event Handler (Units 3, 4, 5, 6)
// ========================================

chrome.debugger.onEvent.addListener(async (source, method, params) => {
  const tabId = source.tabId
  const state = debuggerState.get(tabId)
  if (!state?.attached) return

  switch (method) {
    // --- Network domain (Unit 3) ---
    case 'Network.requestWillBeSent': {
      const type = params.type // 'XHR', 'Fetch', 'Document', etc.
      if (type !== 'XHR' && type !== 'Fetch') return

      pendingRequests.set(params.requestId, {
        _tabId: tabId,
        id: crypto.randomUUID(),
        type: type === 'XHR' ? 'xhr' : 'fetch',
        method: params.request.method,
        url: params.request.url,
        requestHeaders: params.request.headers || {},
        requestBody: params.request.postData || null,
        timestamp: params.wallTime ? params.wallTime * 1000 : Date.now(),
        _startTime: params.timestamp,
      })

      // Get post data if needed
      if (params.request.hasPostData && !params.request.postData) {
        try {
          const result = await chrome.debugger.sendCommand({ tabId }, 'Network.getRequestPostData', { requestId: params.requestId })
          const pending = pendingRequests.get(params.requestId)
          if (pending) pending.requestBody = result.postData
        } catch (e) {
          const pending = pendingRequests.get(params.requestId)
          if (pending) pending.requestBody = '[Unable to retrieve request body]'
        }
      }
      break
    }

    case 'Network.responseReceived': {
      const req = pendingRequests.get(params.requestId)
      if (!req) return

      req.status = params.response.status
      req.statusText = params.response.statusText
      req.responseHeaders = params.response.headers || {}
      req._mimeType = params.response.mimeType
      break
    }

    case 'Network.loadingFinished': {
      const req = pendingRequests.get(params.requestId)
      if (!req) return
      pendingRequests.delete(params.requestId)

      // Skip mocked requests (already emitted by Fetch handler)
      if (mockedNetworkIds.has(params.requestId)) {
        mockedNetworkIds.delete(params.requestId)
        return
      }

      // Calculate duration
      req.duration = Math.round((params.timestamp - req._startTime) * 1000)

      // Get response body
      try {
        const { body, base64Encoded } = await chrome.debugger.sendCommand(
          { tabId }, 'Network.getResponseBody', { requestId: params.requestId }
        )
        let responseBody = base64Encoded ? atob(body) : body

        // Truncate large bodies
        if (typeof responseBody === 'string' && responseBody.length > MAX_RESPONSE_BODY_SIZE) {
          responseBody = responseBody.slice(0, MAX_RESPONSE_BODY_SIZE) + '... [truncated]'
        }

        // Parse JSON if applicable
        const contentType = req._mimeType || ''
        if (contentType.includes('json')) {
          try {
            req.responseBody = JSON.parse(responseBody)
          } catch {
            req.responseBody = responseBody
          }
        } else {
          req.responseBody = responseBody
        }
      } catch (e) {
        req.responseBody = null
      }

      req.error = null
      req.pageUrl = state.pageUrl || ''
      req.pageTitle = state.pageTitle || ''

      // Clean internal fields
      delete req._tabId
      delete req._startTime
      delete req._mimeType

      emitRequest(tabId, req)
      break
    }

    case 'Network.loadingFailed': {
      const req = pendingRequests.get(params.requestId)
      if (!req) return
      pendingRequests.delete(params.requestId)

      // Skip mocked
      if (mockedNetworkIds.has(params.requestId)) {
        mockedNetworkIds.delete(params.requestId)
        return
      }

      req.duration = Math.round((params.timestamp - req._startTime) * 1000)
      req.status = 0
      req.statusText = 'Network Error'
      req.responseHeaders = {}
      req.responseBody = null
      req.error = params.errorText || 'Request failed'
      req.pageUrl = state.pageUrl || ''
      req.pageTitle = state.pageTitle || ''

      delete req._tabId
      delete req._startTime
      delete req._mimeType

      emitRequest(tabId, req)
      break
    }

    // --- Runtime domain (Unit 4) ---
    case 'Runtime.exceptionThrown': {
      const details = params.exceptionDetails
      const isUnhandledRejection = (details.text || '').toLowerCase().includes('unhandled')

      const error = {
        id: crypto.randomUUID(),
        type: isUnhandledRejection ? 'unhandledrejection' : 'error',
        message: details.exception?.description || details.text || 'Unknown error',
        filename: details.url || undefined,
        lineno: details.lineNumber || undefined,
        colno: details.columnNumber || undefined,
        stack: details.exception?.description || details.stackTrace?.callFrames?.map(
          f => `  at ${f.functionName || '(anonymous)'} (${f.url}:${f.lineNumber}:${f.columnNumber})`
        ).join('\n') || null,
        timestamp: Date.now(),
        pageUrl: state.pageUrl || '',
        pageTitle: state.pageTitle || '',
      }

      emitConsoleError(tabId, error)
      break
    }

    case 'Runtime.consoleAPICalled': {
      if (params.type !== 'error') return

      const message = params.args.map(arg => {
        if (arg.type === 'string') return arg.value
        if (arg.description) return arg.description
        try { return JSON.stringify(arg.value) } catch { return String(arg.value) }
      }).join(' ')

      const error = {
        id: crypto.randomUUID(),
        type: 'console.error',
        message,
        timestamp: Date.now(),
        pageUrl: state.pageUrl || '',
        pageTitle: state.pageTitle || '',
      }

      emitConsoleError(tabId, error)
      break
    }

    // --- Fetch domain (Units 5, 6) ---
    case 'Fetch.requestPaused': {
      const url = params.request.url
      const reqMethod = params.request.method

      // Get current rules
      const { mockRules = [], breakpointRules = [] } = await chrome.storage.local.get(['mockRules', 'breakpointRules'])

      // Check breakpoints first (preserving current behavior)
      const matchedBreakpoint = breakpointRules.find(rule => {
        if (!rule.enabled) return false
        if (rule.method && rule.method !== 'ALL' && rule.method !== reqMethod) return false
        return matchUrlPattern(url, rule.urlPattern)
      })

      if (matchedBreakpoint) {
        // Pause the request and notify side panel
        const timeoutId = setTimeout(async () => {
          // Auto-continue after 30 seconds
          try {
            await chrome.debugger.sendCommand({ tabId }, 'Fetch.continueRequest', { requestId: params.requestId })
          } catch (e) {}
          pausedRequests.delete(params.requestId)
          notifySidePanel({ type: 'BREAKPOINT_REQUEST_EXPIRED', requestId: params.requestId })
        }, 30000)

        pausedRequests.set(params.requestId, {
          tabId,
          request: params.request,
          networkId: params.networkId,
          timeout: timeoutId,
        })

        notifySidePanel({
          type: 'BREAKPOINT_REQUEST_PAUSED',
          requestId: params.requestId,
          request: {
            url,
            method: reqMethod,
          },
          tabId,
        })
        return // Don't continue or fulfill yet
      }

      // Check mocks second
      const matchedMock = mockRules.find(rule => {
        if (!rule.enabled) return false
        if (rule.method && rule.method !== 'ALL' && rule.method !== reqMethod) return false
        return matchUrlPattern(url, rule.urlPattern)
      })

      if (matchedMock) {
        // Track networkId for dedup with Network domain
        if (params.networkId) {
          mockedNetworkIds.add(params.networkId)
        }

        // Build response headers
        const headers = []
        const mockHeaders = matchedMock.responseHeaders || {}
        for (const [name, value] of Object.entries(mockHeaders)) {
          headers.push({ name, value })
        }
        if (!headers.some(h => h.name.toLowerCase() === 'content-type')) {
          headers.push({ name: 'content-type', value: 'application/json' })
        }

        try {
          await chrome.debugger.sendCommand({ tabId }, 'Fetch.fulfillRequest', {
            requestId: params.requestId,
            responseCode: matchedMock.status || 200,
            responseHeaders: headers,
            body: btoa(unescape(encodeURIComponent(matchedMock.responseBody || '{}'))),
          })
        } catch (e) {
          // Fallback: continue the request normally
          try {
            await chrome.debugger.sendCommand({ tabId }, 'Fetch.continueRequest', { requestId: params.requestId })
          } catch (e2) {}
          return
        }

        // Emit mocked request to side panel
        let responseBody
        try {
          responseBody = JSON.parse(matchedMock.responseBody || '{}')
        } catch {
          responseBody = matchedMock.responseBody
        }

        emitRequest(tabId, {
          id: crypto.randomUUID(),
          type: 'fetch',
          method: reqMethod,
          url,
          requestHeaders: Object.fromEntries(
            (params.request.headers || []).map(h => [h.name, h.value])
          ),
          requestBody: params.request.postData || null,
          status: matchedMock.status || 200,
          statusText: 'OK (Mocked)',
          responseHeaders: mockHeaders,
          responseBody,
          duration: 0,
          timestamp: Date.now(),
          error: null,
          pageUrl: state.pageUrl || '',
          pageTitle: state.pageTitle || '',
          mocked: true,
        })
        return
      }

      // No match — continue the request
      try {
        await chrome.debugger.sendCommand({ tabId }, 'Fetch.continueRequest', { requestId: params.requestId })
      } catch (e) {}
      break
    }
  }
})

// ========================================
// Fetch Pattern Management (Unit 5)
// ========================================

async function updateFetchPatterns(tabId) {
  const state = debuggerState.get(tabId)
  if (!state?.attached) return

  const { mockRules = [], breakpointRules = [] } = await chrome.storage.local.get(['mockRules', 'breakpointRules'])

  const enabledPatterns = []
  for (const rule of mockRules) {
    if (rule.enabled) enabledPatterns.push(toCdpPattern(rule.urlPattern))
  }
  for (const rule of breakpointRules) {
    if (rule.enabled) enabledPatterns.push(toCdpPattern(rule.urlPattern))
  }

  // Disable existing Fetch interception
  if (state.fetchEnabled) {
    try {
      await chrome.debugger.sendCommand({ tabId }, 'Fetch.disable', {})
    } catch (e) {}
    state.fetchEnabled = false
  }

  if (enabledPatterns.length > 0) {
    const patterns = [...new Set(enabledPatterns)].map(p => ({
      urlPattern: p,
      requestStage: 'Request',
    }))

    try {
      await chrome.debugger.sendCommand({ tabId }, 'Fetch.enable', { patterns })
      state.fetchEnabled = true
    } catch (e) {
      console.error('[Reqpane] Failed to enable Fetch patterns:', e)
    }
  }
}

// ========================================
// Request/Error Emission
// ========================================

function emitRequest(tabId, request) {
  if (!apiRequests.has(tabId)) {
    apiRequests.set(tabId, [])
  }

  const requests = apiRequests.get(tabId)
  requests.unshift(request)
  if (requests.length > MAX_REQUESTS_PER_TAB) {
    requests.pop()
  }

  notifySidePanel({
    type: 'NEW_API_REQUEST',
    payload: request,
    tabId,
  })
}

function emitConsoleError(tabId, error) {
  if (!consoleErrors.has(tabId)) {
    consoleErrors.set(tabId, [])
  }

  const errors = consoleErrors.get(tabId)
  errors.unshift(error)
  if (errors.length > MAX_ERRORS_PER_TAB) {
    errors.pop()
  }

  notifySidePanel({
    type: 'NEW_CONSOLE_ERROR',
    payload: error,
    tabId,
  })
}

// ========================================
// Message Handler
// ========================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id) return

  switch (message.type) {
    case 'GET_TAB_INFO': {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          sendResponse({
            title: tabs[0].title,
            url: tabs[0].url,
            favIconUrl: tabs[0].favIconUrl,
          })
        }
      })
      return true
    }

    case 'GET_API_REQUESTS': {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tabId = tabs[0]?.id
        const requests = tabId ? (apiRequests.get(tabId) || []) : []
        sendResponse({ requests, tabId })
      })
      return true
    }

    case 'CLEAR_API_REQUESTS': {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tabId = tabs[0]?.id
        if (tabId) apiRequests.set(tabId, [])
        sendResponse({ success: true })
      })
      return true
    }

    case 'GET_CONSOLE_ERRORS': {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tabId = tabs[0]?.id
        const errors = tabId ? (consoleErrors.get(tabId) || []) : []
        sendResponse({ errors, tabId })
      })
      return true
    }

    case 'CLEAR_CONSOLE_ERRORS': {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tabId = tabs[0]?.id
        if (tabId) consoleErrors.set(tabId, [])
        sendResponse({ success: true })
      })
      return true
    }

    case 'GET_MOCK_RULES': {
      chrome.storage.local.get(['mockRules'], (result) => {
        sendResponse({ rules: result.mockRules || [] })
      })
      return true
    }

    case 'SAVE_MOCK_RULES': {
      chrome.storage.local.set({ mockRules: message.payload }, () => {
        // Update Fetch patterns for attached tabs
        for (const [tabId, state] of debuggerState) {
          if (state.attached) updateFetchPatterns(tabId)
        }
        sendResponse({ success: true })
      })
      return true
    }

    case 'GET_BREAKPOINT_RULES': {
      chrome.storage.local.get(['breakpointRules'], (result) => {
        sendResponse({ rules: result.breakpointRules || [] })
      })
      return true
    }

    case 'SAVE_BREAKPOINT_RULES': {
      chrome.storage.local.set({ breakpointRules: message.payload }, () => {
        // Update Fetch patterns for attached tabs
        for (const [tabId, state] of debuggerState) {
          if (state.attached) updateFetchPatterns(tabId)
        }
        sendResponse({ success: true })
      })
      return true
    }

    case 'RESUME_PAUSED_REQUEST': {
      const { requestId, action } = message
      const paused = pausedRequests.get(requestId)
      if (!paused) return

      clearTimeout(paused.timeout)
      pausedRequests.delete(requestId)

      if (action === 'continue') {
        chrome.debugger.sendCommand({ tabId: paused.tabId }, 'Fetch.continueRequest', {
          requestId,
        }).catch(() => {})
      } else {
        chrome.debugger.sendCommand({ tabId: paused.tabId }, 'Fetch.failRequest', {
          requestId,
          errorReason: 'BlockedByClient',
        }).catch(() => {})
      }
      return false
    }
  }
})

// ========================================
// Tab Lifecycle
// ========================================

chrome.tabs.onRemoved.addListener((tabId) => {
  apiRequests.delete(tabId)
  consoleErrors.delete(tabId)
  debuggerState.delete(tabId)
  // Clean up pending requests for this tab
  for (const [reqId, req] of pendingRequests) {
    if (req._tabId === tabId) pendingRequests.delete(reqId)
  }
})

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
  if (changeInfo.status === 'loading') {
    // Clear captured data on navigation
    if (apiRequests.has(tabId)) apiRequests.set(tabId, [])
    if (consoleErrors.has(tabId)) consoleErrors.set(tabId, [])

    // Clear pending requests
    for (const [reqId, req] of pendingRequests) {
      if (req._tabId === tabId) pendingRequests.delete(reqId)
    }

    // Update cached page info
    const state = debuggerState.get(tabId)
    if (state?.attached) {
      try {
        const tab = await chrome.tabs.get(tabId)
        state.pageUrl = tab.url || ''
        state.pageTitle = tab.title || ''
      } catch (e) {}

      // Re-enable Fetch patterns after navigation (safe default)
      await updateFetchPatterns(tabId)
    }
  }

  // Update page title when it changes
  if (changeInfo.title) {
    const state = debuggerState.get(tabId)
    if (state) state.pageTitle = changeInfo.title
  }
})

chrome.tabs.onReplaced.addListener(async (addedTabId, removedTabId) => {
  apiRequests.delete(removedTabId)
  consoleErrors.delete(removedTabId)
  debuggerState.delete(removedTabId)

  if (sidePanelPort && activeTabId === removedTabId) {
    activeTabId = addedTabId
    await attachDebugger(addedTabId)
  }
})
