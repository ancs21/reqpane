// Injected into page context to intercept fetch and XHR
(function() {
  const sendToExtension = (data) => {
    window.postMessage({ type: 'API_DEBUGGER_REQUEST', payload: data }, '*');
  };

  // Mock rules storage
  let mockRules = [];

  // Breakpoint rules storage
  let breakpointRules = [];
  const pendingBreakpoints = new Map(); // id -> { resolve, reject }

  // Listen for rules updates
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;

    if (event.data?.type === 'API_DEBUGGER_MOCK_RULES') {
      mockRules = event.data.payload || [];
      console.log('[API Debugger] Mock rules updated:', mockRules.length, 'rules');
    }

    if (event.data?.type === 'API_DEBUGGER_BREAKPOINT_RULES') {
      breakpointRules = event.data.payload || [];
      console.log('[API Debugger] Breakpoint rules updated:', breakpointRules.length, 'rules');
    }

    // Handle breakpoint response from content script overlay
    if (event.data?.type === 'API_DEBUGGER_BREAKPOINT_RESPONSE') {
      const { id, action } = event.data.payload;
      const pending = pendingBreakpoints.get(id);
      if (pending) {
        pendingBreakpoints.delete(id);
        if (action === 'continue') {
          pending.resolve();
        } else {
          pending.reject(new Error('Request cancelled by breakpoint'));
        }
      }
    }
  });

  // Check if URL matches a mock rule
  const findMatchingMock = (url, method) => {
    return mockRules.find(rule => {
      if (!rule.enabled) return false;
      if (rule.method && rule.method !== 'ALL' && rule.method !== method) return false;

      // Simple pattern matching (supports * wildcard)
      const pattern = rule.urlPattern;
      if (pattern.includes('*')) {
        const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
        return regex.test(url);
      }
      return url.includes(pattern);
    });
  };

  // Check if URL matches a breakpoint rule
  const findMatchingBreakpoint = (url, method) => {
    return breakpointRules.find(rule => {
      if (!rule.enabled) return false;
      if (rule.method && rule.method !== 'ALL' && rule.method !== method) return false;

      const pattern = rule.urlPattern;
      if (pattern.includes('*')) {
        const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
        return regex.test(url);
      }
      return url.includes(pattern);
    });
  };

  // Trigger breakpoint and wait for user response
  const triggerBreakpoint = (requestData) => {
    return new Promise((resolve, reject) => {
      pendingBreakpoints.set(requestData.id, { resolve, reject });

      // Notify content script to show overlay
      window.postMessage({
        type: 'API_DEBUGGER_BREAKPOINT_HIT',
        payload: requestData
      }, '*');
    });
  };

  // Create mock response for fetch
  const createMockFetchResponse = (mock, url) => {
    const headers = new Headers(mock.responseHeaders || {});
    if (!headers.has('content-type')) {
      headers.set('content-type', 'application/json');
    }

    return new Response(mock.responseBody || '{}', {
      status: mock.status || 200,
      statusText: mock.statusText || 'OK (Mocked)',
      headers,
    });
  };

  // Intercept Fetch
  const originalFetch = window.fetch;
  window.fetch = async function(...args) {
    const startTime = performance.now();
    const request = args[0];
    const options = args[1] || {};

    const url = typeof request === 'string' ? request : request.url;
    const method = options.method || (typeof request === 'object' ? request.method : 'GET') || 'GET';

    let requestBody = null;
    try {
      if (options.body) {
        requestBody = typeof options.body === 'string'
          ? options.body
          : JSON.stringify(options.body);
      }
    } catch (e) {
      requestBody = '[Unable to parse body]';
    }

    const requestHeaders = {};
    if (options.headers) {
      if (options.headers instanceof Headers) {
        options.headers.forEach((value, key) => {
          requestHeaders[key] = value;
        });
      } else {
        Object.assign(requestHeaders, options.headers);
      }
    }

    const requestData = {
      id: crypto.randomUUID(),
      type: 'fetch',
      method: method.toUpperCase(),
      url,
      requestHeaders,
      requestBody,
      timestamp: Date.now(),
    };

    // Check for matching breakpoint
    const matchingBreakpoint = findMatchingBreakpoint(url, method.toUpperCase());
    if (matchingBreakpoint) {
      try {
        await triggerBreakpoint(requestData);
        // User chose to continue
      } catch (error) {
        // User cancelled the request
        const duration = performance.now() - startTime;
        sendToExtension({
          ...requestData,
          status: 0,
          statusText: 'Cancelled',
          responseHeaders: {},
          responseBody: null,
          duration: Math.round(duration),
          error: 'Request cancelled by breakpoint',
          breakpointCancelled: true,
        });
        throw error;
      }
    }

    // Check for matching mock rule
    const matchingMock = findMatchingMock(url, method.toUpperCase());
    if (matchingMock) {
      const duration = performance.now() - startTime;
      const mockResponse = createMockFetchResponse(matchingMock, url);

      // Parse response body for logging
      let responseBody;
      try {
        responseBody = JSON.parse(matchingMock.responseBody || '{}');
      } catch {
        responseBody = matchingMock.responseBody;
      }

      const responseHeaders = {};
      mockResponse.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      sendToExtension({
        ...requestData,
        status: matchingMock.status || 200,
        statusText: 'OK (Mocked)',
        responseHeaders,
        responseBody,
        duration: Math.round(duration),
        error: null,
        mocked: true,
      });

      return mockResponse;
    }

    try {
      const response = await originalFetch.apply(this, args);
      const duration = performance.now() - startTime;

      // Clone response to read body
      const clone = response.clone();
      let responseBody = null;
      try {
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          responseBody = await clone.json();
        } else if (contentType.includes('text/')) {
          responseBody = await clone.text();
        } else {
          responseBody = '[Binary or unsupported content type]';
        }
      } catch (e) {
        responseBody = '[Unable to parse response]';
      }

      const responseHeaders = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      sendToExtension({
        ...requestData,
        status: response.status,
        statusText: response.statusText,
        responseHeaders,
        responseBody,
        duration: Math.round(duration),
        error: null,
      });

      return response;
    } catch (error) {
      const duration = performance.now() - startTime;

      sendToExtension({
        ...requestData,
        status: 0,
        statusText: 'Network Error',
        responseHeaders: {},
        responseBody: null,
        duration: Math.round(duration),
        error: error.message,
      });

      throw error;
    }
  };

  // Intercept XMLHttpRequest
  const originalXHROpen = XMLHttpRequest.prototype.open;
  const originalXHRSend = XMLHttpRequest.prototype.send;
  const originalXHRSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;

  XMLHttpRequest.prototype.open = function(method, url, ...rest) {
    this._apiDebugger = {
      id: crypto.randomUUID(),
      type: 'xhr',
      method: method.toUpperCase(),
      url: new URL(url, window.location.href).href,
      requestHeaders: {},
      timestamp: Date.now(),
    };
    return originalXHROpen.apply(this, [method, url, ...rest]);
  };

  XMLHttpRequest.prototype.setRequestHeader = function(name, value) {
    if (this._apiDebugger) {
      this._apiDebugger.requestHeaders[name] = value;
    }
    return originalXHRSetRequestHeader.apply(this, [name, value]);
  };

  XMLHttpRequest.prototype.send = function(body) {
    if (this._apiDebugger) {
      const startTime = performance.now();

      try {
        this._apiDebugger.requestBody = body ?
          (typeof body === 'string' ? body : JSON.stringify(body)) : null;
      } catch (e) {
        this._apiDebugger.requestBody = '[Unable to parse body]';
      }

      // Check for matching mock rule
      const matchingMock = findMatchingMock(this._apiDebugger.url, this._apiDebugger.method);
      if (matchingMock) {
        const duration = performance.now() - startTime;

        // Parse response body for logging
        let responseBody;
        try {
          responseBody = JSON.parse(matchingMock.responseBody || '{}');
        } catch {
          responseBody = matchingMock.responseBody;
        }

        const responseHeaders = matchingMock.responseHeaders || {};

        // Send to extension
        sendToExtension({
          ...this._apiDebugger,
          status: matchingMock.status || 200,
          statusText: 'OK (Mocked)',
          responseHeaders,
          responseBody,
          duration: Math.round(duration),
          error: null,
          mocked: true,
        });

        // Simulate XHR response
        const xhr = this;
        Object.defineProperty(xhr, 'status', { value: matchingMock.status || 200 });
        Object.defineProperty(xhr, 'statusText', { value: 'OK (Mocked)' });
        Object.defineProperty(xhr, 'responseText', { value: matchingMock.responseBody || '{}' });
        Object.defineProperty(xhr, 'response', { value: matchingMock.responseBody || '{}' });
        Object.defineProperty(xhr, 'readyState', { value: 4 });

        // Trigger load event async
        setTimeout(() => {
          xhr.dispatchEvent(new Event('load'));
          xhr.dispatchEvent(new Event('loadend'));
        }, 0);

        return;
      }

      this.addEventListener('load', () => {
        const duration = performance.now() - startTime;

        let responseBody = null;
        try {
          const contentType = this.getResponseHeader('content-type') || '';
          if (contentType.includes('application/json')) {
            responseBody = JSON.parse(this.responseText);
          } else {
            responseBody = this.responseText;
          }
        } catch (e) {
          responseBody = this.responseText || '[Unable to parse response]';
        }

        const responseHeaders = {};
        const headerStr = this.getAllResponseHeaders();
        if (headerStr) {
          headerStr.trim().split(/[\r\n]+/).forEach(line => {
            const parts = line.split(': ');
            responseHeaders[parts.shift()] = parts.join(': ');
          });
        }

        sendToExtension({
          ...this._apiDebugger,
          status: this.status,
          statusText: this.statusText,
          responseHeaders,
          responseBody,
          duration: Math.round(duration),
          error: null,
        });
      });

      this.addEventListener('error', () => {
        const duration = performance.now() - startTime;

        sendToExtension({
          ...this._apiDebugger,
          status: 0,
          statusText: 'Network Error',
          responseHeaders: {},
          responseBody: null,
          duration: Math.round(duration),
          error: 'XHR request failed',
        });
      });
    }

    return originalXHRSend.apply(this, [body]);
  };

  // Capture console errors
  const sendError = (data) => {
    window.postMessage({ type: 'API_DEBUGGER_ERROR', payload: data }, '*');
  };

  // Global error handler
  window.addEventListener('error', (event) => {
    sendError({
      id: crypto.randomUUID(),
      type: 'error',
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      stack: event.error?.stack || null,
      timestamp: Date.now(),
    });
  });

  // Unhandled promise rejection
  window.addEventListener('unhandledrejection', (event) => {
    sendError({
      id: crypto.randomUUID(),
      type: 'unhandledrejection',
      message: event.reason?.message || String(event.reason),
      stack: event.reason?.stack || null,
      timestamp: Date.now(),
    });
  });

  // Intercept console.error
  const originalConsoleError = console.error;
  console.error = function(...args) {
    sendError({
      id: crypto.randomUUID(),
      type: 'console.error',
      message: args.map(arg => {
        try {
          return typeof arg === 'object' ? JSON.stringify(arg) : String(arg);
        } catch {
          return String(arg);
        }
      }).join(' '),
      timestamp: Date.now(),
    });
    return originalConsoleError.apply(this, args);
  };

  console.log('[API Debugger] Network interceptor loaded');
})();
