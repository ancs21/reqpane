import { Collapsible } from '@base-ui-components/react/collapsible'
import {
  AlertCircle,
  CheckCircle,
  ChevronDown,
  History,
  Loader2,
  Play,
  Square,
  Trash2,
  XCircle,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { ApiRequest, LoadTestConfig, LoadTestResult, LoadTestRun, SavedLoadTest } from '../../types'
import {
  clearLoadTestHistory,
  deleteLoadTestResult,
  getLoadTestHistory,
  runLoadTest,
  saveLoadTestResult,
} from '../../utils'

interface LoadTestPanelProps {
  request: ApiRequest
}

type TestStatus = 'idle' | 'running' | 'complete' | 'cancelled'

const DEFAULT_CONFIG: LoadTestConfig = {
  iterations: 10,
  concurrency: 1,
  delayMs: 100,
  timeout: 30000,
}

export function LoadTestPanel({ request }: LoadTestPanelProps) {
  const [config, setConfig] = useState<LoadTestConfig>(DEFAULT_CONFIG)
  const [status, setStatus] = useState<TestStatus>('idle')
  const [progress, setProgress] = useState({ completed: 0, total: 0 })
  const [liveRuns, setLiveRuns] = useState<LoadTestRun[]>([])
  const [result, setResult] = useState<LoadTestResult | null>(null)
  const [history, setHistory] = useState<SavedLoadTest[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const abortControllerRef = useRef<AbortController | null>(null)

  // Load history on mount
  useEffect(() => {
    getLoadTestHistory().then(setHistory)
  }, [])

  const handleRun = useCallback(async () => {
    setStatus('running')
    setProgress({ completed: 0, total: config.iterations })
    setLiveRuns([])
    setResult(null)

    abortControllerRef.current = new AbortController()

    try {
      const testResult = await runLoadTest(
        request,
        config,
        (completed, total, runs) => {
          setProgress({ completed, total })
          setLiveRuns(runs)
        },
        abortControllerRef.current.signal
      )

      if (abortControllerRef.current.signal.aborted) {
        setStatus('cancelled')
      } else {
        setStatus('complete')
        setResult(testResult)

        // Save to history
        await saveLoadTestResult(request.url, request.method, testResult)
        const updatedHistory = await getLoadTestHistory()
        setHistory(updatedHistory)
      }
    } catch {
      setStatus('cancelled')
    }
  }, [request, config])

  const handleStop = useCallback(() => {
    abortControllerRef.current?.abort()
    setStatus('cancelled')
  }, [])

  const handleDeleteHistory = useCallback(async (id: string) => {
    await deleteLoadTestResult(id)
    const updatedHistory = await getLoadTestHistory()
    setHistory(updatedHistory)
  }, [])

  const handleClearHistory = useCallback(async () => {
    await clearLoadTestHistory()
    setHistory([])
  }, [])

  const handleViewHistoryResult = useCallback((saved: SavedLoadTest) => {
    setResult(saved.result)
    setStatus('complete')
    setShowHistory(false)
  }, [])

  // Calculate live stats
  const liveSuccessful = liveRuns.filter(r => r.status >= 200 && r.status < 400 && !r.error).length
  const liveFailed = liveRuns.filter(r => r.status >= 400 || r.error).length

  return (
    <div className="p-3 space-y-4">
      {/* Configuration */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wide">Configuration</h3>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] text-text-muted block mb-1">Iterations (1-100)</label>
            <input
              type="number"
              min={1}
              max={100}
              value={config.iterations}
              onChange={(e) => setConfig({ ...config, iterations: Math.min(100, Math.max(1, Number(e.target.value))) })}
              disabled={status === 'running'}
              className="w-full px-2 py-1.5 text-xs rounded border border-border bg-surface disabled:opacity-50"
            />
          </div>
          <div>
            <label className="text-[10px] text-text-muted block mb-1">Concurrency (1-10)</label>
            <input
              type="number"
              min={1}
              max={10}
              value={config.concurrency}
              onChange={(e) => setConfig({ ...config, concurrency: Math.min(10, Math.max(1, Number(e.target.value))) })}
              disabled={status === 'running'}
              className="w-full px-2 py-1.5 text-xs rounded border border-border bg-surface disabled:opacity-50"
            />
          </div>
          <div>
            <label className="text-[10px] text-text-muted block mb-1">Delay (ms)</label>
            <input
              type="number"
              min={0}
              max={5000}
              value={config.delayMs}
              onChange={(e) => setConfig({ ...config, delayMs: Math.min(5000, Math.max(0, Number(e.target.value))) })}
              disabled={status === 'running'}
              className="w-full px-2 py-1.5 text-xs rounded border border-border bg-surface disabled:opacity-50"
            />
          </div>
          <div>
            <label className="text-[10px] text-text-muted block mb-1">Timeout (ms)</label>
            <input
              type="number"
              min={1000}
              max={60000}
              step={1000}
              value={config.timeout}
              onChange={(e) => setConfig({ ...config, timeout: Math.min(60000, Math.max(1000, Number(e.target.value))) })}
              disabled={status === 'running'}
              className="w-full px-2 py-1.5 text-xs rounded border border-border bg-surface disabled:opacity-50"
            />
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          {status === 'running' ? (
            <button
              onClick={handleStop}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors"
            >
              <Square className="w-3.5 h-3.5" />
              Stop
            </button>
          ) : (
            <button
              onClick={handleRun}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium rounded-lg bg-accent text-white hover:bg-accent/90 transition-colors"
            >
              <Play className="w-3.5 h-3.5" />
              Run Load Test
            </button>
          )}
          <button
            onClick={() => setShowHistory(!showHistory)}
            disabled={status === 'running'}
            className="p-2 rounded-lg border border-border hover:bg-hover transition-colors disabled:opacity-50"
            title="View history"
          >
            <History className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Progress */}
      {status === 'running' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 text-text-muted">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Running...
            </span>
            <span>{progress.completed}/{progress.total}</span>
          </div>
          <div className="h-2 bg-surface rounded-full border border-border overflow-hidden">
            <div
              className="h-full bg-accent transition-all duration-200"
              style={{ width: `${(progress.completed / progress.total) * 100}%` }}
            />
          </div>
          <div className="flex items-center gap-3 text-[10px]">
            <span className="text-emerald-600 flex items-center gap-1">
              <CheckCircle className="w-3 h-3" />
              {liveSuccessful} success
            </span>
            <span className="text-red-500 flex items-center gap-1">
              <XCircle className="w-3 h-3" />
              {liveFailed} failed
            </span>
          </div>
        </div>
      )}

      {/* Results */}
      {(status === 'complete' || status === 'cancelled') && result && (
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wide">
            Results {status === 'cancelled' && '(Partial)'}
          </h3>

          {/* Stats cards */}
          <div className="grid grid-cols-3 gap-2">
            <div className="p-3 rounded-lg bg-surface border border-border text-center">
              <div className={`text-lg font-bold ${
                result.stats.successful === result.stats.total ? 'text-emerald-600' :
                result.stats.failed > result.stats.successful ? 'text-red-500' : 'text-amber-500'
              }`}>
                {((result.stats.successful / result.stats.total) * 100).toFixed(1)}%
              </div>
              <div className="text-[10px] text-text-muted">Success Rate</div>
            </div>
            <div className="p-3 rounded-lg bg-surface border border-border text-center">
              <div className="text-lg font-bold">
                {Math.round(result.stats.avgTime)}ms
              </div>
              <div className="text-[10px] text-text-muted">Avg Time</div>
            </div>
            <div className="p-3 rounded-lg bg-surface border border-border text-center">
              <div className="text-lg font-bold">
                {result.stats.requestsPerSecond.toFixed(1)}
              </div>
              <div className="text-[10px] text-text-muted">Req/sec</div>
            </div>
          </div>

          {/* Timing stats */}
          <div className="text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-text-muted">Min</span>
              <span>{Math.round(result.stats.minTime)}ms</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">Max</span>
              <span>{Math.round(result.stats.maxTime)}ms</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">Median</span>
              <span>{Math.round(result.stats.medianTime)}ms</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">P95</span>
              <span>{Math.round(result.stats.p95Time)}ms</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">P99</span>
              <span>{Math.round(result.stats.p99Time)}ms</span>
            </div>
          </div>

          {/* Latency distribution */}
          <Collapsible.Root>
            <Collapsible.Trigger className="flex items-center gap-1 text-xs text-text-muted hover:text-text w-full">
              <ChevronDown className="w-3.5 h-3.5 transition-transform [[data-panel-open]_&]:rotate-180" />
              Latency Distribution
            </Collapsible.Trigger>
            <Collapsible.Panel className="pt-2">
              <LatencyHistogram runs={result.runs} />
            </Collapsible.Panel>
          </Collapsible.Root>

          {/* Error details */}
          {result.stats.failed > 0 && (
            <Collapsible.Root>
              <Collapsible.Trigger className="flex items-center gap-1 text-xs text-red-500 hover:text-red-600 w-full">
                <ChevronDown className="w-3.5 h-3.5 transition-transform [[data-panel-open]_&]:rotate-180" />
                Error Details ({result.stats.failed})
              </Collapsible.Trigger>
              <Collapsible.Panel className="pt-2">
                <ErrorDetails runs={result.runs} />
              </Collapsible.Panel>
            </Collapsible.Root>
          )}
        </div>
      )}

      {/* History */}
      {showHistory && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wide">History</h3>
            {history.length > 0 && (
              <button
                onClick={handleClearHistory}
                className="text-[10px] text-red-500 hover:text-red-600"
              >
                Clear All
              </button>
            )}
          </div>
          {history.length === 0 ? (
            <p className="text-xs text-text-muted py-2">No saved tests</p>
          ) : (
            <div className="space-y-1 max-h-48 overflow-auto">
              {history.slice(0, 10).map((saved) => (
                <div
                  key={saved.id}
                  className="flex items-center justify-between p-2 rounded-lg bg-surface border border-border text-xs"
                >
                  <button
                    onClick={() => handleViewHistoryResult(saved)}
                    className="flex-1 text-left hover:text-accent"
                  >
                    <div className="font-medium truncate">{saved.method} {new URL(saved.url).pathname}</div>
                    <div className="text-[10px] text-text-muted">
                      {new Date(saved.savedAt).toLocaleString()} - {saved.result.stats.total} requests
                    </div>
                  </button>
                  <button
                    onClick={() => handleDeleteHistory(saved.id)}
                    className="p-1 text-text-muted hover:text-red-500"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* CORS Warning */}
      <div className="flex items-start gap-2 p-2 rounded-lg bg-amber-50 border border-amber-200 text-[10px] text-amber-700">
        <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
        <span>
          Cross-origin requests may be blocked by CORS. Load tests work best for same-origin APIs or APIs that allow your extension.
        </span>
      </div>
    </div>
  )
}

function LatencyHistogram({ runs }: { runs: LoadTestRun[] }) {
  const buckets = [
    { label: '<100ms', max: 100 },
    { label: '100-200ms', max: 200 },
    { label: '200-500ms', max: 500 },
    { label: '500ms-1s', max: 1000 },
    { label: '>1s', max: Infinity },
  ]

  const counts = buckets.map((bucket, i) => {
    const min = i === 0 ? 0 : buckets[i - 1].max
    return runs.filter(r => r.duration >= min && r.duration < bucket.max).length
  })

  const maxCount = Math.max(...counts, 1)

  return (
    <div className="space-y-1">
      {buckets.map((bucket, i) => (
        <div key={bucket.label} className="flex items-center gap-2 text-[10px]">
          <span className="w-16 text-text-muted">{bucket.label}</span>
          <div className="flex-1 h-4 bg-surface rounded border border-border overflow-hidden">
            <div
              className="h-full bg-accent transition-all"
              style={{ width: `${(counts[i] / maxCount) * 100}%` }}
            />
          </div>
          <span className="w-6 text-right">{counts[i]}</span>
        </div>
      ))}
    </div>
  )
}

function ErrorDetails({ runs }: { runs: LoadTestRun[] }) {
  const errors = runs.filter(r => r.status >= 400 || r.error)

  // Group by error message
  const grouped = errors.reduce((acc, run) => {
    const key = run.error || `HTTP ${run.status}`
    if (!acc[key]) acc[key] = 0
    acc[key]++
    return acc
  }, {} as Record<string, number>)

  return (
    <div className="space-y-1">
      {Object.entries(grouped).map(([error, count]) => (
        <div key={error} className="flex items-center justify-between p-2 rounded bg-red-50 border border-red-200 text-[10px]">
          <span className="text-red-700 truncate flex-1">{error}</span>
          <span className="text-red-500 font-medium ml-2">{count}x</span>
        </div>
      ))}
    </div>
  )
}
