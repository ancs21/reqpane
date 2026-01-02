import type { ApiRequest, LoadTestConfig, LoadTestResult, LoadTestRun, LoadTestStats } from '../types'

function percentile(sortedArr: number[], p: number): number {
  if (sortedArr.length === 0) return 0
  const index = Math.ceil((p / 100) * sortedArr.length) - 1
  return sortedArr[Math.max(0, index)]
}

function calculateStats(runs: LoadTestRun[], startTime: number, endTime: number): LoadTestStats {
  const successful = runs.filter(r => r.status >= 200 && r.status < 400 && !r.error)
  const failed = runs.filter(r => r.status >= 400 || r.error)
  const durations = runs.map(r => r.duration).sort((a, b) => a - b)

  const total = runs.length
  const avgTime = durations.length > 0
    ? durations.reduce((a, b) => a + b, 0) / durations.length
    : 0
  const minTime = durations.length > 0 ? durations[0] : 0
  const maxTime = durations.length > 0 ? durations[durations.length - 1] : 0
  const medianTime = percentile(durations, 50)
  const p95Time = percentile(durations, 95)
  const p99Time = percentile(durations, 99)

  const totalTimeSeconds = (endTime - startTime) / 1000
  const requestsPerSecond = totalTimeSeconds > 0 ? total / totalTimeSeconds : 0

  return {
    total,
    successful: successful.length,
    failed: failed.length,
    minTime,
    maxTime,
    avgTime,
    medianTime,
    p95Time,
    p99Time,
    requestsPerSecond,
  }
}

async function executeRequest(
  request: ApiRequest,
  timeout: number,
  signal?: AbortSignal
): Promise<LoadTestRun> {
  const startTime = performance.now()
  const timestamp = Date.now()

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    // Combine abort signals
    const combinedSignal = signal
      ? AbortSignal.any([signal, controller.signal])
      : controller.signal

    const options: RequestInit = {
      method: request.method,
      headers: request.requestHeaders,
      signal: combinedSignal,
    }

    if (request.requestBody && request.method !== 'GET') {
      options.body = typeof request.requestBody === 'string'
        ? request.requestBody
        : JSON.stringify(request.requestBody)
    }

    const response = await fetch(request.url, options)
    clearTimeout(timeoutId)

    // Consume response body but don't store it
    await response.text()

    const duration = Math.round(performance.now() - startTime)

    return {
      status: response.status,
      duration,
      timestamp,
    }
  } catch (err) {
    const duration = Math.round(performance.now() - startTime)
    const error = err instanceof Error ? err.message : 'Unknown error'

    return {
      status: 0,
      duration,
      error,
      timestamp,
    }
  }
}

export async function runLoadTest(
  request: ApiRequest,
  config: LoadTestConfig,
  onProgress: (completed: number, total: number, runs: LoadTestRun[]) => void,
  abortSignal?: AbortSignal
): Promise<LoadTestResult> {
  const startTime = Date.now()
  const runs: LoadTestRun[] = []
  let completed = 0

  // Create batches based on concurrency
  const batches: number[][] = []
  for (let i = 0; i < config.iterations; i += config.concurrency) {
    const batchSize = Math.min(config.concurrency, config.iterations - i)
    batches.push(Array.from({ length: batchSize }, (_, j) => i + j))
  }

  for (const batch of batches) {
    // Check if aborted
    if (abortSignal?.aborted) {
      break
    }

    // Execute batch concurrently
    const batchPromises = batch.map(() =>
      executeRequest(request, config.timeout, abortSignal)
    )

    const batchResults = await Promise.all(batchPromises)
    runs.push(...batchResults)
    completed += batchResults.length

    // Report progress
    onProgress(completed, config.iterations, [...runs])

    // Apply delay between batches (if not last batch)
    if (config.delayMs > 0 && completed < config.iterations && !abortSignal?.aborted) {
      await new Promise(resolve => setTimeout(resolve, config.delayMs))
    }
  }

  const endTime = Date.now()
  const stats = calculateStats(runs, startTime, endTime)

  return {
    config,
    runs,
    stats,
    startTime,
    endTime,
  }
}

// Storage helpers for load test history
const STORAGE_KEY = 'loadtest_history'
const MAX_HISTORY = 50

export async function saveLoadTestResult(
  url: string,
  method: string,
  result: LoadTestResult
): Promise<void> {
  const saved = {
    id: crypto.randomUUID(),
    url,
    method,
    result,
    savedAt: Date.now(),
  }

  return new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEY], (data) => {
      const history = (data[STORAGE_KEY] || []) as Array<typeof saved>
      const newHistory = [saved, ...history].slice(0, MAX_HISTORY)
      chrome.storage.local.set({ [STORAGE_KEY]: newHistory }, resolve)
    })
  })
}

export async function getLoadTestHistory(): Promise<Array<{
  id: string
  url: string
  method: string
  result: LoadTestResult
  savedAt: number
}>> {
  return new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEY], (data) => {
      resolve((data[STORAGE_KEY] || []) as Array<{
        id: string
        url: string
        method: string
        result: LoadTestResult
        savedAt: number
      }>)
    })
  })
}

export async function deleteLoadTestResult(id: string): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEY], (data) => {
      const history = (data[STORAGE_KEY] || []) as Array<{ id: string }>
      const newHistory = history.filter((h) => h.id !== id)
      chrome.storage.local.set({ [STORAGE_KEY]: newHistory }, resolve)
    })
  })
}

export async function clearLoadTestHistory(): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.remove([STORAGE_KEY], resolve)
  })
}
