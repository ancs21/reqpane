import { useState, useEffect } from 'react'
import { Tabs } from '@base-ui-components/react/tabs'
import { Collapsible } from '@base-ui-components/react/collapsible'
import { Terminal, X, ChevronDown, Code, Braces, Play, Loader2, Plus, Trash2, Send, Activity } from 'lucide-react'
import type { ApiRequest } from '../../types'
import { TabButton, CodeCopyBlock, JsonTreeView, LoadTestPanel } from '../index'
import { generateCurl, generateFetchCode, generateTypeScript } from '../../utils'
import { useFieldUsage } from '../../hooks/useFieldUsage'

interface RequestDetailProps {
  request: ApiRequest
  onClose: () => void
  onCopy: () => void
  copied: boolean
}

export function RequestDetail({
  request,
  onClose,
  onCopy,
  copied,
}: RequestDetailProps) {
  const [activeTab, setActiveTab] = useState('response')
  const [replaying, setReplaying] = useState(false)
  const [replayResult, setReplayResult] = useState<{ status: number; body: unknown; error?: string } | null>(null)

  // Edit & Resend state
  const [editUrl, setEditUrl] = useState(request.url)
  const [editMethod, setEditMethod] = useState(request.method)
  const [editHeaders, setEditHeaders] = useState<Array<{ key: string; value: string }>>(
    Object.entries(request.requestHeaders || {}).map(([key, value]) => ({ key, value }))
  )
  const [editBody, setEditBody] = useState(
    request.requestBody ? (typeof request.requestBody === 'string' ? request.requestBody : JSON.stringify(request.requestBody, null, 2)) : ''
  )
  const [editResult, setEditResult] = useState<{ status: number; body: unknown; error?: string } | null>(null)
  const [editSending, setEditSending] = useState(false)

  // Field usage tracking for JSON tree
  const fieldUsage = useFieldUsage(request.responseBody)

  // Clear highlights when component unmounts or request changes
  useEffect(() => {
    return () => {
      fieldUsage.clearHighlights()
    }
  }, [request.id])

  const handleReplay = async () => {
    setReplaying(true)
    setReplayResult(null)
    try {
      const options: RequestInit = {
        method: request.method,
        headers: request.requestHeaders,
      }
      if (request.requestBody && request.method !== 'GET') {
        options.body = typeof request.requestBody === 'string'
          ? request.requestBody
          : JSON.stringify(request.requestBody)
      }
      const res = await fetch(request.url, options)
      const contentType = res.headers.get('content-type') || ''
      let body: unknown
      if (contentType.includes('application/json')) {
        body = await res.json()
      } else {
        body = await res.text()
      }
      setReplayResult({ status: res.status, body })
    } catch (err) {
      setReplayResult({ status: 0, body: null, error: (err as Error).message })
    } finally {
      setReplaying(false)
    }
  }

  const handleEditSend = async () => {
    setEditSending(true)
    setEditResult(null)
    try {
      const headers: Record<string, string> = {}
      editHeaders.forEach(h => {
        if (h.key.trim()) headers[h.key.trim()] = h.value
      })

      const options: RequestInit = {
        method: editMethod,
        headers,
      }
      if (editBody && editMethod !== 'GET') {
        options.body = editBody
      }
      const res = await fetch(editUrl, options)
      const contentType = res.headers.get('content-type') || ''
      let body: unknown
      if (contentType.includes('application/json')) {
        body = await res.json()
      } else {
        body = await res.text()
      }
      setEditResult({ status: res.status, body })
    } catch (err) {
      setEditResult({ status: 0, body: null, error: (err as Error).message })
    } finally {
      setEditSending(false)
    }
  }

  const addHeader = () => {
    setEditHeaders([...editHeaders, { key: '', value: '' }])
  }

  const removeHeader = (index: number) => {
    setEditHeaders(editHeaders.filter((_, i) => i !== index))
  }

  const updateHeader = (index: number, field: 'key' | 'value', value: string) => {
    const newHeaders = [...editHeaders]
    newHeaders[index][field] = value
    setEditHeaders(newHeaders)
  }

  const formatJson = (data: unknown) => {
    try {
      if (typeof data === 'string') {
        return JSON.stringify(JSON.parse(data), null, 2)
      }
      return JSON.stringify(data, null, 2)
    } catch {
      return String(data)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Drag Handle */}
      <div className="flex justify-center pt-3 pb-2">
        <div className="w-10 h-1 rounded-full bg-border" />
      </div>

      {/* Detail Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-semibold text-accent">
            {request.method}
          </span>
          <span className={`text-xs px-1.5 py-0.5 rounded ${
            request.status >= 400 ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'
          }`}>
            {request.status}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onCopy}
            className={`px-2 py-1 text-xs rounded transition-colors ${
              copied
                ? 'bg-emerald-100 text-emerald-600'
                : 'bg-accent text-white hover:opacity-90'
            }`}
          >
            {copied ? 'Copied!' : 'Copy context'}
          </button>
          <button
            onClick={onClose}
            className="p-1 text-text-muted hover:text-text rounded hover:bg-hover"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* URL */}
      <div className="px-4 py-2 border-b border-border shrink-0">
        <p className="text-[10px] text-text-muted mb-0.5">URL</p>
        <p className="text-xs font-mono break-all max-h-16 overflow-auto">{request.url}</p>
      </div>

      {/* Tabs */}
      <Tabs.Root value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <Tabs.List className="flex border-b border-border shrink-0">
          <TabButton value="response" active={activeTab === 'response'}>Response</TabButton>
          <TabButton value="request" active={activeTab === 'request'}>Request</TabButton>
          <TabButton value="headers" active={activeTab === 'headers'}>Headers</TabButton>
          <TabButton value="edit" active={activeTab === 'edit'}>Edit</TabButton>
          <TabButton value="code" active={activeTab === 'code'}>Code</TabButton>
          <TabButton value="loadtest" active={activeTab === 'loadtest'}>
            <Activity className="w-3 h-3 mr-1 inline" />
            Load
          </TabButton>
        </Tabs.List>

        <div className="flex-1 overflow-auto min-h-0">
          <Tabs.Panel value="response" className="p-3 h-full">
            {request.responseBody ? (
              <JsonTreeView
                data={request.responseBody}
                usageCache={fieldUsage.usageCache.size > 0 ? fieldUsage.usageCache : undefined}
                onHighlight={fieldUsage.highlightField}
                onScan={fieldUsage.scanAllFields}
                scanStatus={fieldUsage.scanStatus}
                progress={fieldUsage.progress}
              />
            ) : (
              <div className="text-xs text-text-muted italic">(empty response)</div>
            )}
          </Tabs.Panel>

          <Tabs.Panel value="request" className="p-3">
            <pre className="text-xs font-mono whitespace-pre-wrap break-all bg-bg p-3 rounded-lg border border-border">
              {request.requestBody ? formatJson(request.requestBody) : '(empty)'}
            </pre>
          </Tabs.Panel>

          <Tabs.Panel value="headers" className="p-3">
            <Collapsible.Root defaultOpen>
              <Collapsible.Trigger className="flex items-center gap-1 text-xs font-medium mb-2">
                <ChevronDown className="w-3 h-3" />
                Request Headers
              </Collapsible.Trigger>
              <Collapsible.Panel>
                <div className="space-y-1 mb-4">
                  {Object.entries(request.requestHeaders).map(([key, value]) => (
                    <div key={key} className="text-xs font-mono">
                      <span className="text-accent">{key}:</span>{' '}
                      <span className="text-text-muted">{value}</span>
                    </div>
                  ))}
                  {Object.keys(request.requestHeaders).length === 0 && (
                    <p className="text-xs text-text-muted">(none)</p>
                  )}
                </div>
              </Collapsible.Panel>
            </Collapsible.Root>

            <Collapsible.Root defaultOpen>
              <Collapsible.Trigger className="flex items-center gap-1 text-xs font-medium mb-2">
                <ChevronDown className="w-3 h-3" />
                Response Headers
              </Collapsible.Trigger>
              <Collapsible.Panel>
                <div className="space-y-1">
                  {Object.entries(request.responseHeaders).map(([key, value]) => (
                    <div key={key} className="text-xs font-mono">
                      <span className="text-accent">{key}:</span>{' '}
                      <span className="text-text-muted">{value}</span>
                    </div>
                  ))}
                  {Object.keys(request.responseHeaders).length === 0 && (
                    <p className="text-xs text-text-muted">(none)</p>
                  )}
                </div>
              </Collapsible.Panel>
            </Collapsible.Root>
          </Tabs.Panel>

          <Tabs.Panel value="edit" className="p-3">
            <div className="space-y-3">
              {/* Method & URL */}
              <div className="flex gap-2">
                <select
                  value={editMethod}
                  onChange={(e) => setEditMethod(e.target.value)}
                  className="px-2 py-1.5 text-xs font-mono rounded-lg border border-border bg-surface focus:outline-none focus:border-accent"
                >
                  <option>GET</option>
                  <option>POST</option>
                  <option>PUT</option>
                  <option>PATCH</option>
                  <option>DELETE</option>
                </select>
                <input
                  type="text"
                  value={editUrl}
                  onChange={(e) => setEditUrl(e.target.value)}
                  className="flex-1 px-2 py-1.5 text-xs font-mono rounded-lg border border-border bg-surface focus:outline-none focus:border-accent"
                  placeholder="URL"
                />
              </div>

              {/* Headers */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium">Headers</span>
                  <button
                    onClick={addHeader}
                    className="flex items-center gap-1 px-2 py-1 text-xs text-accent hover:bg-accent-light rounded transition-colors"
                  >
                    <Plus className="w-3 h-3" /> Add
                  </button>
                </div>
                <div className="space-y-1">
                  {editHeaders.map((header, i) => (
                    <div key={i} className="flex gap-1">
                      <input
                        type="text"
                        value={header.key}
                        onChange={(e) => updateHeader(i, 'key', e.target.value)}
                        className="w-1/3 px-2 py-1 text-xs font-mono rounded border border-border bg-surface focus:outline-none focus:border-accent"
                        placeholder="Key"
                      />
                      <input
                        type="text"
                        value={header.value}
                        onChange={(e) => updateHeader(i, 'value', e.target.value)}
                        className="flex-1 px-2 py-1 text-xs font-mono rounded border border-border bg-surface focus:outline-none focus:border-accent"
                        placeholder="Value"
                      />
                      <button
                        onClick={() => removeHeader(i)}
                        className="p-1 text-red-500 hover:bg-red-50 rounded"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Body */}
              {editMethod !== 'GET' && (
                <div>
                  <span className="text-xs font-medium mb-2 block">Body</span>
                  <textarea
                    value={editBody}
                    onChange={(e) => setEditBody(e.target.value)}
                    className="w-full h-24 px-2 py-1.5 text-xs font-mono rounded-lg border border-border bg-surface focus:outline-none focus:border-accent resize-none"
                    placeholder="Request body (JSON)"
                  />
                </div>
              )}

              {/* Send Button */}
              <button
                onClick={handleEditSend}
                disabled={editSending}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-accent text-white font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {editSending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                {editSending ? 'Sending...' : 'Send Request'}
              </button>

              {/* Result */}
              {editResult && (
                <div className={`rounded-lg border p-3 ${editResult.error ? 'border-red-200 bg-red-50' : 'border-emerald-200 bg-emerald-50'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-xs font-medium ${editResult.error ? 'text-red-600' : 'text-emerald-600'}`}>
                      {editResult.error ? 'Error' : `Status: ${editResult.status}`}
                    </span>
                  </div>
                  <pre className="text-xs font-mono whitespace-pre-wrap break-all max-h-32 overflow-auto">
                    {editResult.error || JSON.stringify(editResult.body, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </Tabs.Panel>

          <Tabs.Panel value="code" className="p-3">
            <div className="space-y-3">
              {/* Replay Button */}
              <button
                onClick={handleReplay}
                disabled={replaying}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-accent text-white font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {replaying ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Play className="w-4 h-4" />
                )}
                {replaying ? 'Replaying...' : 'Replay Request'}
              </button>

              {/* Replay Result */}
              {replayResult && (
                <div className={`rounded-lg border p-3 ${replayResult.error ? 'border-red-200 bg-red-50' : 'border-emerald-200 bg-emerald-50'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-xs font-medium ${replayResult.error ? 'text-red-600' : 'text-emerald-600'}`}>
                      {replayResult.error ? 'Error' : `Status: ${replayResult.status}`}
                    </span>
                  </div>
                  <pre className="text-xs font-mono whitespace-pre-wrap break-all max-h-32 overflow-auto">
                    {replayResult.error || JSON.stringify(replayResult.body, null, 2)}
                  </pre>
                </div>
              )}

              <CodeCopyBlock
                label="cURL"
                icon={<Terminal className="w-4 h-4" />}
                code={generateCurl(request)}
              />
              <CodeCopyBlock
                label="fetch()"
                icon={<Code className="w-4 h-4" />}
                code={generateFetchCode(request)}
              />
              <CodeCopyBlock
                label="TypeScript"
                icon={<Braces className="w-4 h-4" />}
                code={generateTypeScript(request)}
              />
            </div>
          </Tabs.Panel>

          <Tabs.Panel value="loadtest" className="h-full overflow-auto">
            <LoadTestPanel request={request} />
          </Tabs.Panel>
        </div>
      </Tabs.Root>
    </div>
  )
}
