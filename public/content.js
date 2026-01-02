// Content script - bridges injected script to extension

// Inject the interceptor script into page context
const script = document.createElement('script');
script.src = chrome.runtime.getURL('injected.js');
script.onload = function() {
  this.remove();
};
(document.head || document.documentElement).appendChild(script);

// Listen for messages from injected script
window.addEventListener('message', (event) => {
  if (event.source !== window) return;

  // Forward API requests
  if (event.data?.type === 'API_DEBUGGER_REQUEST') {
    chrome.runtime.sendMessage({
      type: 'API_REQUEST_CAPTURED',
      payload: {
        ...event.data.payload,
        pageUrl: window.location.href,
        pageTitle: document.title,
      }
    }).catch(() => {});
  }

  // Forward console errors
  if (event.data?.type === 'API_DEBUGGER_ERROR') {
    chrome.runtime.sendMessage({
      type: 'CONSOLE_ERROR_CAPTURED',
      payload: {
        ...event.data.payload,
        pageUrl: window.location.href,
        pageTitle: document.title,
      }
    }).catch(() => {});
  }
});

// Notify background that content script is ready
chrome.runtime.sendMessage({ type: 'CONTENT_SCRIPT_READY' }).catch(() => {});

// Listen for mock and breakpoint rules updates from background
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'MOCK_RULES_UPDATED') {
    // Forward mock rules to injected script
    window.postMessage({
      type: 'API_DEBUGGER_MOCK_RULES',
      payload: message.payload,
    }, '*');
  }

  if (message.type === 'BREAKPOINT_RULES_UPDATED') {
    // Forward breakpoint rules to injected script
    window.postMessage({
      type: 'API_DEBUGGER_BREAKPOINT_RULES',
      payload: message.payload,
    }, '*');
  }
});

// Breakpoint overlay handling
let breakpointOverlay = null;

window.addEventListener('message', (event) => {
  if (event.source !== window) return;

  // Handle breakpoint hit - show overlay
  if (event.data?.type === 'API_DEBUGGER_BREAKPOINT_HIT') {
    showBreakpointOverlay(event.data.payload);
  }
});

function showBreakpointOverlay(request) {
  // Remove existing overlay if any
  if (breakpointOverlay) {
    breakpointOverlay.remove();
  }

  // Create overlay
  breakpointOverlay = document.createElement('div');
  breakpointOverlay.id = 'api-debugger-breakpoint-overlay';
  breakpointOverlay.innerHTML = `
    <div style="
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.7);
      z-index: 999999;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    ">
      <div style="
        background: white;
        border-radius: 12px;
        padding: 24px;
        max-width: 500px;
        width: 90%;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
      ">
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
          <div style="
            width: 40px;
            height: 40px;
            background: #dc2626;
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
          ">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          </div>
          <div>
            <h2 style="margin: 0; font-size: 18px; font-weight: 600; color: #111;">Breakpoint Hit</h2>
            <p style="margin: 4px 0 0; font-size: 12px; color: #666;">Request paused before sending</p>
          </div>
        </div>
        <div style="
          background: #f9fafb;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 12px;
          margin-bottom: 20px;
        ">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
            <span style="
              font-size: 12px;
              font-weight: 600;
              font-family: monospace;
              color: ${request.method === 'GET' ? '#059669' : request.method === 'POST' ? '#2563eb' : request.method === 'DELETE' ? '#dc2626' : '#d97706'};
            ">${request.method}</span>
          </div>
          <p style="
            margin: 0;
            font-size: 13px;
            font-family: monospace;
            color: #374151;
            word-break: break-all;
          ">${request.url}</p>
        </div>
        <div style="display: flex; gap: 12px;">
          <button id="api-debugger-bp-cancel" style="
            flex: 1;
            padding: 10px 16px;
            border: 1px solid #e5e7eb;
            background: white;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            color: #374151;
          ">Cancel Request</button>
          <button id="api-debugger-bp-continue" style="
            flex: 1;
            padding: 10px 16px;
            border: none;
            background: #2563eb;
            color: white;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
          ">Continue</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(breakpointOverlay);

  // Add event listeners
  document.getElementById('api-debugger-bp-continue').addEventListener('click', () => {
    window.postMessage({
      type: 'API_DEBUGGER_BREAKPOINT_RESPONSE',
      payload: { id: request.id, action: 'continue' }
    }, '*');
    breakpointOverlay.remove();
    breakpointOverlay = null;
  });

  document.getElementById('api-debugger-bp-cancel').addEventListener('click', () => {
    window.postMessage({
      type: 'API_DEBUGGER_BREAKPOINT_RESPONSE',
      payload: { id: request.id, action: 'cancel' }
    }, '*');
    breakpointOverlay.remove();
    breakpointOverlay = null;
  });
}

// ========================================
// DOM Field Search & Highlight System
// ========================================

class DOMFieldSearcher {
  constructor() {
    this.textNodesCache = null;
    this.cacheTimestamp = 0;
    this.CACHE_TTL = 2000; // 2 seconds
  }

  buildTextNodesCache() {
    const now = Date.now();
    if (this.textNodesCache && (now - this.cacheTimestamp) < this.CACHE_TTL) {
      return this.textNodesCache;
    }

    // Guard against document.body not existing yet
    if (!document.body) {
      this.textNodesCache = [];
      return this.textNodesCache;
    }

    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;

          const tagName = parent.tagName.toLowerCase();
          if (['script', 'style', 'noscript', 'template'].includes(tagName)) {
            return NodeFilter.FILTER_REJECT;
          }

          if (!node.textContent?.trim()) {
            return NodeFilter.FILTER_REJECT;
          }

          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    this.textNodesCache = [];
    let node;
    while ((node = walker.nextNode())) {
      this.textNodesCache.push({
        node,
        text: node.textContent,
        element: node.parentElement
      });
    }

    this.cacheTimestamp = now;
    return this.textNodesCache;
  }

  searchValue(value, options = {}) {
    const { maxResults = 50 } = options;

    const searchStr = this.normalizeValue(value);
    if (!searchStr || searchStr.length < 2) {
      return { count: 0, elements: [] };
    }

    const textNodes = this.buildTextNodesCache();
    const results = [];
    const seenElements = new Set();

    for (const { text, element } of textNodes) {
      if (results.length >= maxResults) break;

      const elementId = element.outerHTML.slice(0, 200);
      if (seenElements.has(elementId)) continue;

      if (!this.isVisible(element)) continue;

      if (this.textMatches(text, searchStr)) {
        seenElements.add(elementId);
        results.push({
          selector: this.generateSelector(element),
          textPreview: text.slice(0, 100),
          isVisible: true,
          tagName: element.tagName.toLowerCase()
        });
      }
    }

    return { count: results.length, elements: results };
  }

  normalizeValue(value) {
    if (value === null || value === undefined) return '';
    if (typeof value === 'boolean') return value.toString();
    if (typeof value === 'number') return value.toString();
    if (typeof value === 'string') return value.trim();
    return '';
  }

  textMatches(text, searchStr) {
    const textLower = text.toLowerCase();
    const searchLower = searchStr.toLowerCase();

    // Direct contains match (most common case)
    if (textLower.includes(searchLower)) {
      return true;
    }

    // For numbers, also try matching with common formatting
    if (/^\d+$/.test(searchStr)) {
      // Try with thousand separators (1234 -> 1,234)
      const formatted = searchStr.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      if (textLower.includes(formatted.toLowerCase())) {
        return true;
      }
    }

    return false;
  }

  escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  isVisible(element) {
    const style = window.getComputedStyle(element);
    return (
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      style.opacity !== '0' &&
      element.offsetParent !== null
    );
  }

  generateSelector(element) {
    const path = [];
    let current = element;

    while (current && current !== document.body) {
      let selector = current.tagName.toLowerCase();

      if (current.id) {
        selector = `#${current.id}`;
        path.unshift(selector);
        break;
      }

      if (current.className && typeof current.className === 'string') {
        const classes = current.className.trim().split(/\s+/).slice(0, 2);
        if (classes.length && classes[0]) {
          selector += `.${classes.join('.')}`;
        }
      }

      const parent = current.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children).filter(
          c => c.tagName === current.tagName
        );
        if (siblings.length > 1) {
          const index = siblings.indexOf(current) + 1;
          selector += `:nth-of-type(${index})`;
        }
      }

      path.unshift(selector);
      current = current.parentElement;
    }

    return path.join(' > ');
  }

  batchSearch(values) {
    this.buildTextNodesCache();
    const results = {};
    for (const { path, value } of values) {
      results[path] = this.searchValue(value);
    }
    return results;
  }
}

class HighlightManager {
  constructor() {
    this.overlays = [];
    this.styleElement = null;
  }

  injectStyles() {
    if (this.styleElement) return;

    this.styleElement = document.createElement('style');
    this.styleElement.id = 'api-debugger-highlight-styles';
    this.styleElement.textContent = `
      .api-debugger-highlight {
        position: absolute;
        pointer-events: none;
        background: rgba(14, 165, 233, 0.2);
        border: 2px solid rgba(14, 165, 233, 0.8);
        border-radius: 4px;
        z-index: 999998;
        animation: api-debugger-pulse 1.5s ease-in-out infinite;
      }
      .api-debugger-highlight-label {
        position: absolute;
        top: -22px;
        left: 0;
        background: rgba(14, 165, 233, 0.95);
        color: white;
        font-size: 11px;
        padding: 2px 8px;
        border-radius: 4px;
        font-family: system-ui, sans-serif;
        white-space: nowrap;
        font-weight: 500;
      }
      @keyframes api-debugger-pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.6; }
      }
    `;
    document.head.appendChild(this.styleElement);
  }

  highlightElements(elements, label = '') {
    this.clearHighlights();
    this.injectStyles();

    elements.forEach((el, index) => {
      try {
        const element = document.querySelector(el.selector);
        if (!element) return;

        const rect = element.getBoundingClientRect();
        const overlay = document.createElement('div');
        overlay.className = 'api-debugger-highlight';
        overlay.style.cssText = `
          top: ${rect.top + window.scrollY}px;
          left: ${rect.left + window.scrollX}px;
          width: ${rect.width}px;
          height: ${rect.height}px;
        `;

        if (index === 0 && label) {
          const labelEl = document.createElement('div');
          labelEl.className = 'api-debugger-highlight-label';
          labelEl.textContent = `${label} (${elements.length} found)`;
          overlay.appendChild(labelEl);
        }

        document.body.appendChild(overlay);
        this.overlays.push(overlay);

        if (index === 0) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      } catch (e) {
        console.warn('[API Debugger] Failed to highlight:', e);
      }
    });
  }

  clearHighlights() {
    this.overlays.forEach(overlay => overlay.remove());
    this.overlays = [];
  }
}

const domSearcher = new DOMFieldSearcher();
const highlightManager = new HighlightManager();

// Handle DOM search messages from side panel
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SEARCH_DOM_FOR_VALUE') {
    console.log('[API Debugger] Searching for value:', message.value);
    const result = domSearcher.searchValue(message.value, message.options);
    console.log('[API Debugger] Search result:', result);
    sendResponse(result);
    return true;
  }

  if (message.type === 'BATCH_SEARCH_DOM') {
    console.log('[API Debugger] Batch search for', message.values?.length, 'values');
    const results = domSearcher.batchSearch(message.values);
    const foundCount = Object.values(results).filter(r => r.count > 0).length;
    console.log('[API Debugger] Batch results:', foundCount, 'found of', Object.keys(results).length);
    sendResponse(results);
    return true;
  }

  if (message.type === 'HIGHLIGHT_ELEMENTS') {
    highlightManager.highlightElements(message.elements, message.label);
    sendResponse({ success: true });
    return true;
  }

  if (message.type === 'CLEAR_HIGHLIGHTS') {
    highlightManager.clearHighlights();
    sendResponse({ success: true });
    return true;
  }
});

// Clear highlights on navigation
window.addEventListener('beforeunload', () => {
  highlightManager.clearHighlights();
});

// Invalidate cache on DOM mutations
let mutationTimeout;
const mutationObserver = new MutationObserver(() => {
  clearTimeout(mutationTimeout);
  mutationTimeout = setTimeout(() => {
    domSearcher.textNodesCache = null;
  }, 500);
});

// Wait for body to exist before observing (content script runs at document_start)
const startObserving = () => {
  if (document.body) {
    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true
    });
  } else {
    // Body doesn't exist yet, wait for DOMContentLoaded
    document.addEventListener('DOMContentLoaded', () => {
      mutationObserver.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true
      });
    }, { once: true });
  }
};
startObserving();
