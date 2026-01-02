import { useState } from 'react'
import { X } from 'lucide-react'
import type { MockRule } from '../../types'

interface MockRuleEditorProps {
  rule: MockRule
  onSave: (rule: MockRule) => void
  onCancel: () => void
}

export function MockRuleEditor({
  rule,
  onSave,
  onCancel,
}: MockRuleEditorProps) {
  const [urlPattern, setUrlPattern] = useState(rule.urlPattern)
  const [method, setMethod] = useState(rule.method)
  const [status, setStatus] = useState(rule.status)
  const [responseBody, setResponseBody] = useState(rule.responseBody)

  const handleSave = () => {
    onSave({
      ...rule,
      urlPattern,
      method,
      status,
      responseBody,
    })
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-center pt-3 pb-2">
        <div className="w-10 h-1 rounded-full bg-border" />
      </div>

      <div className="flex items-center justify-between px-4 py-2 border-b border-border shrink-0">
        <span className="text-sm font-medium">
          {rule.urlPattern ? 'Edit Rule' : 'New Rule'}
        </span>
        <button
          onClick={onCancel}
          className="p-1 text-text-muted hover:text-text rounded hover:bg-hover"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-4">
        <div>
          <label className="text-xs font-medium mb-1 block">URL Pattern</label>
          <input
            type="text"
            value={urlPattern}
            onChange={(e) => setUrlPattern(e.target.value)}
            placeholder="e.g., /api/users/* or example.com/api/*"
            className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-border bg-surface focus:outline-none focus:border-purple-500"
          />
          <p className="text-[10px] text-text-muted mt-1">
            Use * as wildcard. Matches if URL contains pattern.
          </p>
        </div>

        <div className="flex gap-3">
          <div className="flex-1">
            <label className="text-xs font-medium mb-1 block">Method</label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as MockRule['method'])}
              className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-surface focus:outline-none focus:border-purple-500"
            >
              <option value="ALL">ALL</option>
              <option value="GET">GET</option>
              <option value="POST">POST</option>
              <option value="PUT">PUT</option>
              <option value="PATCH">PATCH</option>
              <option value="DELETE">DELETE</option>
            </select>
          </div>
          <div className="w-24">
            <label className="text-xs font-medium mb-1 block">Status</label>
            <input
              type="number"
              value={status}
              onChange={(e) => setStatus(parseInt(e.target.value) || 200)}
              className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-border bg-surface focus:outline-none focus:border-purple-500"
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-medium mb-1 block">Response Body (JSON)</label>
          <textarea
            value={responseBody}
            onChange={(e) => setResponseBody(e.target.value)}
            placeholder='{"message": "Mocked response"}'
            className="w-full h-32 px-3 py-2 text-sm font-mono rounded-lg border border-border bg-surface focus:outline-none focus:border-purple-500 resize-none"
          />
        </div>

        <button
          onClick={handleSave}
          disabled={!urlPattern.trim()}
          className="w-full py-2.5 rounded-lg bg-purple-500 text-white font-medium text-sm hover:bg-purple-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Save Rule
        </button>
      </div>
    </div>
  )
}
