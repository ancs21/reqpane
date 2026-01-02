export interface ApiRequest {
  id: string
  type: 'fetch' | 'xhr'
  method: string
  url: string
  requestHeaders: Record<string, string>
  requestBody: string | null
  responseHeaders: Record<string, string>
  responseBody: unknown
  status: number
  statusText: string
  duration: number
  timestamp: number
  error: string | null
  pageUrl: string
  pageTitle: string
  mocked?: boolean
}

export interface MockRule {
  id: string
  urlPattern: string
  method: 'ALL' | 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  status: number
  statusText: string
  responseBody: string
  responseHeaders: Record<string, string>
  enabled: boolean
}

export interface BreakpointRule {
  id: string
  urlPattern: string
  method: 'ALL' | 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  enabled: boolean
}

export interface ConsoleError {
  id: string
  type: 'error' | 'unhandledrejection' | 'console.error'
  message: string
  filename?: string
  lineno?: number
  colno?: number
  stack?: string | null
  timestamp: number
  pageUrl: string
  pageTitle: string
}

export interface UsageResult {
  count: number
  elements: Array<{
    selector: string
    textPreview: string
    isVisible: boolean
    tagName: string
  }>
}

export interface Session {
  id: string
  name: string
  timestamp: number
  count: number
}

export type HttpMethod = 'ALL' | 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
export type FilterType = 'all' | 'errors' | 'slow' | 'console'
export type ViewMode = 'list' | 'timeline' | 'grouped'
export type ScanStatus = 'idle' | 'scanning' | 'complete'

// Load Testing types
export interface LoadTestConfig {
  iterations: number      // Total requests to send (1-100)
  concurrency: number     // Parallel requests (1-10)
  delayMs: number         // Delay between batches (0-5000ms)
  timeout: number         // Request timeout (1000-60000ms)
}

export interface LoadTestRun {
  status: number
  duration: number
  error?: string
  timestamp: number
}

export interface LoadTestStats {
  total: number
  successful: number
  failed: number
  minTime: number
  maxTime: number
  avgTime: number
  medianTime: number
  p95Time: number
  p99Time: number
  requestsPerSecond: number
}

export interface LoadTestResult {
  config: LoadTestConfig
  runs: LoadTestRun[]
  stats: LoadTestStats
  startTime: number
  endTime: number
}

export interface SavedLoadTest {
  id: string
  url: string
  method: string
  result: LoadTestResult
  savedAt: number
}
