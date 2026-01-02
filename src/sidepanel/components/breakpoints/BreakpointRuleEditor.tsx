import { useState } from 'react'
import { X } from 'lucide-react'
import type { BreakpointRule } from '../../types'

interface BreakpointRuleEditorProps {
  rule: BreakpointRule
  onSave: (rule: BreakpointRule) => void
  onCancel: () => void
}

export function BreakpointRuleEditor({
  rule,
  onSave,
  onCancel,
}: BreakpointRuleEditorProps) {
  const [urlPattern, setUrlPattern] = useState(rule.urlPattern)
  const [method, setMethod] = useState(rule.method)

  const handleSave = () => {
    onSave({
      ...rule,
      urlPattern,
      method,
    })
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-center pt-3 pb-2">
        <div className="w-10 h-1 rounded-full bg-border" />
      </div>

      <div className="flex items-center justify-between px-4 py-2 border-b border-border shrink-0">
        <span className="text-sm font-medium">
          {rule.urlPattern ? 'Edit Breakpoint' : 'New Breakpoint'}
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
            className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-border bg-surface focus:outline-none focus:border-red-500"
          />
          <p className="text-[10px] text-text-muted mt-1">
            Request will pause before sending when URL matches.
          </p>
        </div>

        <div>
          <label className="text-xs font-medium mb-1 block">Method</label>
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value as BreakpointRule['method'])}
            className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-surface focus:outline-none focus:border-red-500"
          >
            <option value="ALL">ALL</option>
            <option value="GET">GET</option>
            <option value="POST">POST</option>
            <option value="PUT">PUT</option>
            <option value="PATCH">PATCH</option>
            <option value="DELETE">DELETE</option>
          </select>
        </div>

        <button
          onClick={handleSave}
          disabled={!urlPattern.trim()}
          className="w-full py-2.5 rounded-lg bg-red-500 text-white font-medium text-sm hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Save Breakpoint
        </button>
      </div>
    </div>
  )
}
