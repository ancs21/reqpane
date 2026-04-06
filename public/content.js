// Content script - DOM field search and highlight system
// Network capture is now handled by chrome.debugger CDP in background.js

(function() {

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

    if (textLower.includes(searchLower)) {
      return true;
    }

    if (/^\d+$/.test(searchStr)) {
      const formatted = searchStr.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      if (textLower.includes(formatted.toLowerCase())) {
        return true;
      }
    }

    return false;
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
        console.warn('[Reqpane] Failed to highlight:', e);
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
    const result = domSearcher.searchValue(message.value, message.options);
    sendResponse(result);
    return true;
  }

  if (message.type === 'BATCH_SEARCH_DOM') {
    const results = domSearcher.batchSearch(message.values);
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

if (document.body) {
  mutationObserver.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true
  });
} else {
  document.addEventListener('DOMContentLoaded', () => {
    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true
    });
  }, { once: true });
}

})();
