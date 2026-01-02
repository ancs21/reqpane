import { Dialog } from '@base-ui-components/react/dialog';
import {
  AlertTriangle,
  BarChart3,
  Download,
  FileJson,
  FileSearch,
  FileText,
  FolderOpen,
  GitCompare,
  History,
  Inbox,
  List,
  Pause,
  Radio,
  Search,
  Settings,
  Shield,
  Terminal,
  X
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import {
  BreakpointManager,
  ConsoleErrorDetail,
  ConsoleErrorRow,
  DiffDialog,
  FilterButton,
  GroupedView,
  MockManager,
  RequestDetail,
  RequestRow,
  SessionHistory,
  SettingsPanel,
  TimelineView
} from './components';
import type { FontSize } from './components';
import type {
  ApiRequest,
  BreakpointRule,
  ConsoleError,
  MockRule,
} from './types';
import {
  generateClaudePrompt,
  generateHar,
  generateMarkdownReport,
  generatePostmanCollection
} from './utils';

export default function App() {
  const [requests, setRequests] = useState<ApiRequest[]>([]);
  const [consoleErrors, setConsoleErrors] = useState<ConsoleError[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<ApiRequest | null>(
    null
  );
  const [selectedError, setSelectedError] = useState<ConsoleError | null>(null);
  const [filter, setFilter] = useState<'all' | 'errors' | 'slow' | 'console'>(
    'all'
  );
  const [urlFilter, setUrlFilter] = useState('');
  const [copied, setCopied] = useState(false);
  const [autoSelect, setAutoSelect] = useState(false);
  const [mockRules, setMockRules] = useState<MockRule[]>([]);
  const [showMockManager, setShowMockManager] = useState(false);
  const [breakpointRules, setBreakpointRules] = useState<BreakpointRule[]>([]);
  const [showBreakpointManager, setShowBreakpointManager] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]); // Array of request IDs
  const [showSessionHistory, setShowSessionHistory] = useState(false);
  const [sessions, setSessions] = useState<
    Array<{ id: string; name: string; timestamp: number; count: number }>
  >([]);
  const [showExportMenu, setShowExportMenu] = useState(false);

  // New features state
  const [compareMode, setCompareMode] = useState(false);
  const [compareRequests, setCompareRequests] = useState<
    [ApiRequest | null, ApiRequest | null]
  >([null, null]);
  const [showDiff, setShowDiff] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'timeline' | 'grouped'>(
    'list'
  );
  const [bodySearch, setBodySearch] = useState('');

  // Settings state
  const [showSettings, setShowSettings] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [fontSize, setFontSize] = useState<FontSize>('medium');

  // Load mock and breakpoint rules on mount
  useEffect(() => {
    chrome.runtime.sendMessage({ type: 'GET_MOCK_RULES' }, (response) => {
      if (response?.rules) {
        setMockRules(response.rules);
      }
    });
    chrome.runtime.sendMessage({ type: 'GET_BREAKPOINT_RULES' }, (response) => {
      if (response?.rules) {
        setBreakpointRules(response.rules);
      }
    });
  }, []);

  // Load favorites, sessions, and settings from storage
  useEffect(() => {
    chrome.storage.local.get(
      ['favorites', 'sessions', 'darkMode', 'fontSize'],
      (result: {
        favorites?: string[];
        sessions?: Array<{
          id: string;
          name: string;
          timestamp: number;
          count: number;
        }>;
        darkMode?: boolean;
        fontSize?: FontSize;
      }) => {
        if (result.favorites) setFavorites(result.favorites);
        if (result.sessions) setSessions(result.sessions);
        if (result.darkMode !== undefined) setDarkMode(result.darkMode);
        if (result.fontSize) setFontSize(result.fontSize);
      }
    );
  }, []);

  // Apply dark mode and font size to document
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    document.documentElement.setAttribute('data-font-size', fontSize);
  }, [darkMode, fontSize]);

  // Save settings when they change
  const handleDarkModeChange = useCallback((enabled: boolean) => {
    setDarkMode(enabled);
    chrome.storage.local.set({ darkMode: enabled });
  }, []);

  const handleFontSizeChange = useCallback((size: FontSize) => {
    setFontSize(size);
    chrome.storage.local.set({ fontSize: size });
  }, []);

  // Load existing requests and console errors, listen for new ones
  useEffect(() => {
    // Get existing requests
    chrome.runtime.sendMessage({ type: 'GET_API_REQUESTS' }, (response) => {
      if (response?.requests) {
        setRequests(response.requests);
      }
    });

    // Get existing console errors
    chrome.runtime.sendMessage({ type: 'GET_CONSOLE_ERRORS' }, (response) => {
      if (response?.errors) {
        setConsoleErrors(response.errors);
      }
    });

    // Listen for new requests and errors
    const handleMessage = (message: {
      type: string;
      payload: ApiRequest | ConsoleError;
    }) => {
      if (message.type === 'NEW_API_REQUEST') {
        setRequests((prev) =>
          [message.payload as ApiRequest, ...prev].slice(0, 100)
        );
      }
      if (message.type === 'NEW_CONSOLE_ERROR') {
        setConsoleErrors((prev) =>
          [message.payload as ConsoleError, ...prev].slice(0, 50)
        );
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);
    return () => chrome.runtime.onMessage.removeListener(handleMessage);
  }, []);

  // Auto-select new requests
  useEffect(() => {
    if (autoSelect && requests.length > 0) {
      setSelectedRequest(requests[0]);
    }
  }, [autoSelect, requests]);

  // Refresh when tab changes
  useEffect(() => {
    const handleTabChange = () => {
      chrome.runtime.sendMessage({ type: 'GET_API_REQUESTS' }, (response) => {
        if (response?.requests) {
          setRequests(response.requests);
          setSelectedRequest(null);
        }
      });
      chrome.runtime.sendMessage({ type: 'GET_CONSOLE_ERRORS' }, (response) => {
        if (response?.errors) {
          setConsoleErrors(response.errors);
          setSelectedError(null);
        }
      });
    };

    chrome.tabs.onActivated.addListener(handleTabChange);
    return () => chrome.tabs.onActivated.removeListener(handleTabChange);
  }, []);

  const clearRequests = useCallback(() => {
    chrome.runtime.sendMessage({ type: 'CLEAR_API_REQUESTS' }, () => {
      setRequests([]);
      setSelectedRequest(null);
    });
  }, []);

  const clearConsoleErrors = useCallback(() => {
    chrome.runtime.sendMessage({ type: 'CLEAR_CONSOLE_ERRORS' }, () => {
      setConsoleErrors([]);
      setSelectedError(null);
    });
  }, []);

  const clearAll = useCallback(() => {
    clearRequests();
    clearConsoleErrors();
  }, [clearRequests, clearConsoleErrors]);

  const saveMockRules = useCallback((rules: MockRule[]) => {
    setMockRules(rules);
    chrome.runtime.sendMessage({ type: 'SAVE_MOCK_RULES', payload: rules });
  }, []);

  const saveBreakpointRules = useCallback((rules: BreakpointRule[]) => {
    setBreakpointRules(rules);
    chrome.runtime.sendMessage({
      type: 'SAVE_BREAKPOINT_RULES',
      payload: rules,
    });
  }, []);

  // Export to Postman collection
  const exportToPostman = useCallback(() => {
    const collection = generatePostmanCollection(requests);
    const blob = new Blob([JSON.stringify(collection, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `api-debugger-${new Date()
      .toISOString()
      .slice(0, 10)}.postman_collection.json`;
    a.click();
    URL.revokeObjectURL(url);
    setShowExportMenu(false);
  }, [requests]);

  // Toggle favorite
  const toggleFavorite = useCallback((requestId: string) => {
    setFavorites((prev) => {
      const newFavorites = prev.includes(requestId)
        ? prev.filter((id) => id !== requestId)
        : [...prev, requestId];
      chrome.storage.local.set({ favorites: newFavorites });
      return newFavorites;
    });
  }, []);

  // Save current session
  const saveSession = useCallback(() => {
    if (requests.length === 0) return;

    const sessionId = crypto.randomUUID();
    const sessionName = `Session ${new Date().toLocaleString()}`;
    const newSession = {
      id: sessionId,
      name: sessionName,
      timestamp: Date.now(),
      count: requests.length,
    };

    // Save session metadata
    const newSessions = [newSession, ...sessions].slice(0, 20); // Keep last 20 sessions
    setSessions(newSessions);

    // Save session data
    chrome.storage.local.set({
      sessions: newSessions,
      [`session_${sessionId}`]: requests,
    });
    setShowExportMenu(false);
  }, [requests, sessions]);

  // Load session
  const loadSession = useCallback((sessionId: string) => {
    chrome.storage.local.get(
      [`session_${sessionId}`],
      (result: Record<string, ApiRequest[] | undefined>) => {
        const sessionData = result[`session_${sessionId}`];
        if (sessionData) {
          setRequests(sessionData);
          setSelectedRequest(null);
          setShowSessionHistory(false);
        }
      }
    );
  }, []);

  // Delete session
  const deleteSession = useCallback(
    (sessionId: string) => {
      const newSessions = sessions.filter((s) => s.id !== sessionId);
      setSessions(newSessions);
      chrome.storage.local.remove([`session_${sessionId}`]);
      chrome.storage.local.set({ sessions: newSessions });
    },
    [sessions]
  );

  const filteredRequests = requests.filter((req) => {
    // URL filter
    if (
      urlFilter &&
      (!req.url || !req.url.toLowerCase().includes(urlFilter.toLowerCase()))
    ) {
      return false;
    }
    // Body search filter
    if (bodySearch) {
      const searchLower = bodySearch.toLowerCase();
      const reqBody = req.requestBody
        ? String(req.requestBody).toLowerCase()
        : '';
      const resBody = req.responseBody
        ? JSON.stringify(req.responseBody).toLowerCase()
        : '';
      if (!reqBody.includes(searchLower) && !resBody.includes(searchLower)) {
        return false;
      }
    }
    // Status filter
    if (filter === 'errors') return req.status >= 400 || req.error;
    if (filter === 'slow') return req.duration > 1000;
    return true;
  });

  // Group requests by domain
  const groupedRequests = filteredRequests.reduce((acc, req) => {
    try {
      const domain = new URL(req.url).hostname;
      if (!acc[domain]) acc[domain] = [];
      acc[domain].push(req);
    } catch {
      if (!acc['unknown']) acc['unknown'] = [];
      acc['unknown'].push(req);
    }
    return acc;
  }, {} as Record<string, ApiRequest[]>);

  // Toggle request for comparison
  const toggleCompareRequest = useCallback((req: ApiRequest) => {
    setCompareRequests((prev) => {
      if (prev[0]?.id === req.id) return [null, prev[1]];
      if (prev[1]?.id === req.id) return [prev[0], null];
      if (!prev[0]) return [req, prev[1]];
      if (!prev[1]) return [prev[0], req];
      return [req, prev[1]]; // Replace first if both selected
    });
  }, []);

  const apiErrorCount = requests.filter(
    (r) => r.status >= 400 || r.error
  ).length;
  const slowCount = requests.filter((r) => r.duration > 1000).length;
  const consoleErrorCount = consoleErrors.length;

  const copyToClipboard = useCallback(async (req: ApiRequest) => {
    const markdown = generateClaudePrompt(req);
    await navigator.clipboard.writeText(markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, []);

  const exportToHar = useCallback(() => {
    const har = generateHar(requests);
    const blob = new Blob([JSON.stringify(har, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `api-debugger-${new Date().toISOString().slice(0, 10)}.har`;
    a.click();
    URL.revokeObjectURL(url);
  }, [requests]);

  const exportToMarkdown = useCallback(() => {
    // Get page info from the first request or use defaults
    const pageInfo = requests.length > 0
      ? { url: requests[0].pageUrl, title: requests[0].pageTitle }
      : { url: 'Unknown', title: 'Unknown' };

    const report = generateMarkdownReport(requests, consoleErrors, pageInfo);
    const blob = new Blob([report], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `api-report-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
    setShowExportMenu(false);
  }, [requests, consoleErrors]);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="px-4 pt-5 pb-4 border-b border-[var(--color-border)]">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[var(--color-accent)] rounded-lg flex items-center justify-center">
              <Terminal className="w-4 h-4 text-white" strokeWidth={2} />
            </div>
            <div>
              <h1 className="text-base font-semibold">Reqpane</h1>
              <p className="text-[10px] text-[var(--color-text-muted)]">
                {requests.length} requests
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowBreakpointManager(true)}
              className={`p-1.5 rounded transition-colors ${
                breakpointRules.some((r) => r.enabled)
                  ? 'bg-red-500 text-white'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-hover)]'
              }`}
              title={`Breakpoints (${
                breakpointRules.filter((r) => r.enabled).length
              } active)`}
            >
              <Pause className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setShowMockManager(true)}
              className={`p-1.5 rounded transition-colors ${
                mockRules.some((r) => r.enabled)
                  ? 'bg-purple-500 text-white'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-hover)]'
              }`}
              title={`Mock Rules (${
                mockRules.filter((r) => r.enabled).length
              } active)`}
            >
              <Shield className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setAutoSelect(!autoSelect)}
              className={`p-1.5 rounded transition-colors ${
                autoSelect
                  ? 'bg-[var(--color-accent)] text-white'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-hover)]'
              }`}
              title={autoSelect ? 'Auto-select ON' : 'Auto-select OFF'}
            >
              <Radio className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setShowSessionHistory(true)}
              className="p-1.5 rounded transition-colors text-text-muted hover:text-text hover:bg-hover"
              title="Session History"
            >
              <History className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setShowSettings(true)}
              className="p-1.5 rounded transition-colors text-text-muted hover:text-text hover:bg-hover"
              title="Settings"
            >
              <Settings className="w-3.5 h-3.5" />
            </button>
            <div className="relative">
              <button
                onClick={() => setShowExportMenu(!showExportMenu)}
                disabled={requests.length === 0}
                className="p-1.5 rounded transition-colors text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-hover)] disabled:opacity-30"
                title="Export options"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
              {showExportMenu && (
                <div className="absolute right-0 top-full mt-1 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg shadow-lg z-50 py-1 min-w-[160px]">
                  <button
                    onClick={exportToHar}
                    className="w-full px-3 py-2 text-xs text-left hover:bg-[var(--color-hover)] flex items-center gap-2"
                  >
                    <Download className="w-3.5 h-3.5" /> Export as HAR
                  </button>
                  <button
                    onClick={exportToPostman}
                    className="w-full px-3 py-2 text-xs text-left hover:bg-[var(--color-hover)] flex items-center gap-2"
                  >
                    <FileJson className="w-3.5 h-3.5" /> Export to Postman
                  </button>
                  <button
                    onClick={exportToMarkdown}
                    className="w-full px-3 py-2 text-xs text-left hover:bg-[var(--color-hover)] flex items-center gap-2"
                  >
                    <FileText className="w-3.5 h-3.5" /> Markdown Report
                  </button>
                  <hr className="my-1 border-[var(--color-border)]" />
                  <button
                    onClick={saveSession}
                    className="w-full px-3 py-2 text-xs text-left hover:bg-[var(--color-hover)] flex items-center gap-2"
                  >
                    <History className="w-3.5 h-3.5" /> Save Session
                  </button>
                </div>
              )}
            </div>
            <button
              onClick={clearAll}
              className="px-2 py-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-hover)] rounded transition-colors"
            >
              Clear
            </button>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 p-1 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)]">
          <FilterButton
            active={filter === 'all'}
            onClick={() => setFilter('all')}
          >
            All
          </FilterButton>
          <FilterButton
            active={filter === 'errors'}
            onClick={() => setFilter('errors')}
            count={apiErrorCount}
            isError
          >
            Errors
          </FilterButton>
          <FilterButton
            active={filter === 'slow'}
            onClick={() => setFilter('slow')}
            count={slowCount}
          >
            Slow
          </FilterButton>
          <FilterButton
            active={filter === 'console'}
            onClick={() => setFilter('console')}
            count={consoleErrorCount}
            isError
          >
            Console
          </FilterButton>
        </div>

        {/* URL Filter */}
        <div className="relative mt-2">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--color-text-muted)]" />
          <input
            type="text"
            value={urlFilter}
            onChange={(e) => setUrlFilter(e.target.value)}
            placeholder="Filter by URL..."
            className="w-full pl-8 pr-8 py-1.5 text-xs rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)]"
          />
          {urlFilter && (
            <button
              onClick={() => setUrlFilter('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Body Search */}
        <div className="relative mt-2">
          <FileSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--color-text-muted)]" />
          <input
            type="text"
            value={bodySearch}
            onChange={(e) => setBodySearch(e.target.value)}
            placeholder="Search in body..."
            className="w-full pl-8 pr-8 py-1.5 text-xs rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)]"
          />
          {bodySearch && (
            <button
              onClick={() => setBodySearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* View Mode & Compare */}
        <div className="flex items-center justify-between mt-2">
          <div className="flex gap-1 p-0.5 rounded-md bg-[var(--color-surface)] border border-[var(--color-border)]">
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded transition-colors ${
                viewMode === 'list'
                  ? 'bg-[var(--color-accent)] text-white'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
              }`}
              title="List view"
            >
              <List className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('timeline')}
              className={`p-1.5 rounded transition-colors ${
                viewMode === 'timeline'
                  ? 'bg-[var(--color-accent)] text-white'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
              }`}
              title="Timeline view"
            >
              <BarChart3 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('grouped')}
              className={`p-1.5 rounded transition-colors ${
                viewMode === 'grouped'
                  ? 'bg-[var(--color-accent)] text-white'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
              }`}
              title="Group by domain"
            >
              <FolderOpen className="w-3.5 h-3.5" />
            </button>
          </div>
          <button
            onClick={() => {
              setCompareMode(!compareMode);
              if (compareMode) {
                setCompareRequests([null, null]);
              }
            }}
            className={`flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors ${
              compareMode
                ? 'bg-blue-500 text-white'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-hover)]'
            }`}
          >
            <GitCompare className="w-3.5 h-3.5" />
            {compareMode ? 'Exit Compare' : 'Compare'}
          </button>
        </div>

        {/* Compare Selection Info */}
        {compareMode && (
          <div className="mt-2 p-2 rounded-lg bg-blue-50 border border-blue-200 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-blue-700">
                Select 2 requests to compare (
                {compareRequests.filter(Boolean).length}/2)
              </span>
              {compareRequests[0] && compareRequests[1] && (
                <button
                  onClick={() => setShowDiff(true)}
                  className="px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                  View Diff
                </button>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Request List or Console Errors */}
      <div className="flex-1 overflow-auto">
        {filter === 'console' ? (
          // Console Errors List
          consoleErrors.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-[var(--color-text-muted)]">
              <AlertTriangle
                className="w-12 h-12 mb-3 opacity-30"
                strokeWidth={1}
              />
              <p className="text-sm">No console errors</p>
              <p className="text-xs mt-1">JavaScript errors will appear here</p>
            </div>
          ) : (
            <div className="divide-y divide-[var(--color-border)]">
              {consoleErrors.map((err) => (
                <ConsoleErrorRow
                  key={err.id}
                  error={err}
                  isSelected={selectedError?.id === err.id}
                  onClick={() =>
                    setSelectedError(selectedError?.id === err.id ? null : err)
                  }
                />
              ))}
            </div>
          )
        ) : // API Requests List
        filteredRequests.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-[var(--color-text-muted)]">
            <Inbox className="w-12 h-12 mb-3 opacity-30" strokeWidth={1} />
            <p className="text-sm">No requests captured</p>
            <p className="text-xs mt-1">Navigate to a page to start</p>
          </div>
        ) : viewMode === 'timeline' ? (
          <TimelineView
            requests={filteredRequests}
            selectedRequest={selectedRequest}
            onSelect={(req) =>
              setSelectedRequest(selectedRequest?.id === req.id ? null : req)
            }
          />
        ) : viewMode === 'grouped' ? (
          <GroupedView
            groupedRequests={groupedRequests}
            selectedRequest={selectedRequest}
            favorites={favorites}
            compareMode={compareMode}
            compareRequests={compareRequests}
            onSelect={(req) =>
              setSelectedRequest(selectedRequest?.id === req.id ? null : req)
            }
            onToggleFavorite={toggleFavorite}
            onToggleCompare={toggleCompareRequest}
          />
        ) : (
          <div className="divide-y divide-[var(--color-border)]">
            {filteredRequests.map((req) => (
              <RequestRow
                key={req.id}
                request={req}
                isSelected={selectedRequest?.id === req.id}
                isFavorite={favorites.includes(req.id)}
                compareMode={compareMode}
                isCompareSelected={
                  compareRequests[0]?.id === req.id ||
                  compareRequests[1]?.id === req.id
                }
                onClick={() =>
                  setSelectedRequest(
                    selectedRequest?.id === req.id ? null : req
                  )
                }
                onToggleFavorite={() => toggleFavorite(req.id)}
                onToggleCompare={() => toggleCompareRequest(req)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Request Detail Bottom Sheet */}
      <Dialog.Root
        open={!!selectedRequest}
        onOpenChange={(open) => !open && setSelectedRequest(null)}
      >
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 bg-black/40 z-40" />
          <Dialog.Popup className="fixed bottom-0 left-0 right-0 z-50 bg-[var(--color-surface)] rounded-t-2xl max-h-[85vh] flex flex-col shadow-xl">
            {selectedRequest && (
              <RequestDetail
                request={selectedRequest}
                onClose={() => setSelectedRequest(null)}
                onCopy={() => copyToClipboard(selectedRequest)}
                copied={copied}
              />
            )}
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Console Error Detail Bottom Sheet */}
      <Dialog.Root
        open={!!selectedError}
        onOpenChange={(open) => !open && setSelectedError(null)}
      >
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 bg-black/40 z-40" />
          <Dialog.Popup className="fixed bottom-0 left-0 right-0 z-50 bg-[var(--color-surface)] rounded-t-2xl max-h-[85vh] flex flex-col shadow-xl">
            {selectedError && (
              <ConsoleErrorDetail
                error={selectedError}
                onClose={() => setSelectedError(null)}
              />
            )}
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Mock Manager Dialog */}
      <Dialog.Root open={showMockManager} onOpenChange={setShowMockManager}>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 bg-black/40 z-40" />
          <Dialog.Popup className="fixed bottom-0 left-0 right-0 z-50 bg-[var(--color-surface)] rounded-t-2xl max-h-[90vh] flex flex-col shadow-xl">
            <MockManager
              rules={mockRules}
              onSave={saveMockRules}
              onClose={() => setShowMockManager(false)}
            />
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Breakpoint Manager Dialog */}
      <Dialog.Root
        open={showBreakpointManager}
        onOpenChange={setShowBreakpointManager}
      >
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 bg-black/40 z-40" />
          <Dialog.Popup className="fixed bottom-0 left-0 right-0 z-50 bg-[var(--color-surface)] rounded-t-2xl max-h-[90vh] flex flex-col shadow-xl">
            <BreakpointManager
              rules={breakpointRules}
              onSave={saveBreakpointRules}
              onClose={() => setShowBreakpointManager(false)}
            />
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Session History Dialog */}
      <Dialog.Root
        open={showSessionHistory}
        onOpenChange={setShowSessionHistory}
      >
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 bg-black/40 z-40" />
          <Dialog.Popup className="fixed bottom-0 left-0 right-0 z-50 bg-surface rounded-t-2xl max-h-[90vh] flex flex-col shadow-xl">
            <SessionHistory
              sessions={sessions}
              onLoad={loadSession}
              onDelete={deleteSession}
              onClose={() => setShowSessionHistory(false)}
            />
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Settings Dialog */}
      <Dialog.Root open={showSettings} onOpenChange={setShowSettings}>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 bg-black/40 z-40" />
          <Dialog.Popup className="fixed bottom-0 left-0 right-0 z-50 bg-surface rounded-t-2xl max-h-[70vh] flex flex-col shadow-xl">
            <SettingsPanel
              darkMode={darkMode}
              fontSize={fontSize}
              onDarkModeChange={handleDarkModeChange}
              onFontSizeChange={handleFontSizeChange}
              onClose={() => setShowSettings(false)}
            />
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Diff Dialog */}
      <DiffDialog
        open={showDiff}
        onClose={() => setShowDiff(false)}
        requests={compareRequests}
      />
    </div>
  );
}
