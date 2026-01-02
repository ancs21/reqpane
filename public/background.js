// Open side panel when extension icon is clicked
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })

// Re-inject content scripts into existing tabs on install/update
chrome.runtime.onInstalled.addListener(async () => {
  const tabs = await chrome.tabs.query({})
  for (const tab of tabs) {
    // Skip chrome:// and edge:// URLs
    if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('edge://') || tab.url.startsWith('chrome-extension://')) {
      continue
    }
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      })
      console.log('[API Debugger] Injected content script into tab:', tab.id, tab.url)
    } catch (err) {
      // Tab might not allow script injection
      console.log('[API Debugger] Could not inject into tab:', tab.id, err.message)
    }
  }
})

// Store captured API requests and errors
const apiRequests = new Map() // tabId -> requests[]
const consoleErrors = new Map() // tabId -> errors[]
const MAX_REQUESTS_PER_TAB = 100
const MAX_ERRORS_PER_TAB = 50

// Mock rules stored in chrome.storage.local
// Format: { id, urlPattern, method, status, responseBody, responseHeaders, enabled }

// Breakpoint rules stored in chrome.storage.local
// Format: { id, urlPattern, method, enabled }

// Listen for messages from content scripts or side panel
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Validate sender is from this extension
  if (sender.id !== chrome.runtime.id) return

  if (message.type === 'GET_TAB_INFO') {
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

  if (message.type === 'API_REQUEST_CAPTURED') {
    const tabId = sender.tab?.id
    if (!tabId) return

    if (!apiRequests.has(tabId)) {
      apiRequests.set(tabId, [])
    }

    const requests = apiRequests.get(tabId)
    requests.unshift(message.payload) // Add to beginning

    // Limit stored requests
    if (requests.length > MAX_REQUESTS_PER_TAB) {
      requests.pop()
    }

    // Notify side panel of new request
    chrome.runtime.sendMessage({
      type: 'NEW_API_REQUEST',
      payload: message.payload,
      tabId,
    }).catch(() => {
      // Side panel may not be open
    })
  }

  if (message.type === 'GET_API_REQUESTS') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tabId = tabs[0]?.id
      const requests = tabId ? (apiRequests.get(tabId) || []) : []
      sendResponse({ requests, tabId })
    })
    return true
  }

  if (message.type === 'CLEAR_API_REQUESTS') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tabId = tabs[0]?.id
      if (tabId) {
        apiRequests.set(tabId, [])
      }
      sendResponse({ success: true })
    })
    return true
  }

  if (message.type === 'CONSOLE_ERROR_CAPTURED') {
    const tabId = sender.tab?.id
    if (!tabId) return

    if (!consoleErrors.has(tabId)) {
      consoleErrors.set(tabId, [])
    }

    const errors = consoleErrors.get(tabId)
    errors.unshift(message.payload)

    if (errors.length > MAX_ERRORS_PER_TAB) {
      errors.pop()
    }

    chrome.runtime.sendMessage({
      type: 'NEW_CONSOLE_ERROR',
      payload: message.payload,
      tabId,
    }).catch(() => {})
  }

  if (message.type === 'GET_CONSOLE_ERRORS') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tabId = tabs[0]?.id
      const errors = tabId ? (consoleErrors.get(tabId) || []) : []
      sendResponse({ errors, tabId })
    })
    return true
  }

  if (message.type === 'CLEAR_CONSOLE_ERRORS') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tabId = tabs[0]?.id
      if (tabId) {
        consoleErrors.set(tabId, [])
      }
      sendResponse({ success: true })
    })
    return true
  }

  if (message.type === 'CONTENT_SCRIPT_READY') {
    // Content script loaded, send current mock and breakpoint rules
    chrome.storage.local.get(['mockRules', 'breakpointRules'], (result) => {
      if (sender.tab?.id) {
        chrome.tabs.sendMessage(sender.tab.id, {
          type: 'MOCK_RULES_UPDATED',
          payload: result.mockRules || [],
        }).catch(() => {})
        chrome.tabs.sendMessage(sender.tab.id, {
          type: 'BREAKPOINT_RULES_UPDATED',
          payload: result.breakpointRules || [],
        }).catch(() => {})
      }
    })
  }

  if (message.type === 'GET_MOCK_RULES') {
    chrome.storage.local.get(['mockRules'], (result) => {
      sendResponse({ rules: result.mockRules || [] })
    })
    return true
  }

  if (message.type === 'SAVE_MOCK_RULES') {
    chrome.storage.local.set({ mockRules: message.payload }, () => {
      // Notify all tabs about the update
      chrome.tabs.query({}, (tabs) => {
        tabs.forEach(tab => {
          if (tab.id) {
            chrome.tabs.sendMessage(tab.id, {
              type: 'MOCK_RULES_UPDATED',
              payload: message.payload,
            }).catch(() => {})
          }
        })
      })
      sendResponse({ success: true })
    })
    return true
  }

  if (message.type === 'GET_BREAKPOINT_RULES') {
    chrome.storage.local.get(['breakpointRules'], (result) => {
      sendResponse({ rules: result.breakpointRules || [] })
    })
    return true
  }

  if (message.type === 'SAVE_BREAKPOINT_RULES') {
    chrome.storage.local.set({ breakpointRules: message.payload }, () => {
      // Notify all tabs about the update
      chrome.tabs.query({}, (tabs) => {
        tabs.forEach(tab => {
          if (tab.id) {
            chrome.tabs.sendMessage(tab.id, {
              type: 'BREAKPOINT_RULES_UPDATED',
              payload: message.payload,
            }).catch(() => {})
          }
        })
      })
      sendResponse({ success: true })
    })
    return true
  }
})

// Clean up when tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  apiRequests.delete(tabId)
  consoleErrors.delete(tabId)
})

// Clear requests and errors when tab navigates to new page
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'loading') {
    apiRequests.set(tabId, [])
    consoleErrors.set(tabId, [])
  }
})
