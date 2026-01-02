import { useState } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import type { ConsoleError } from '../../types'

interface ConsoleErrorDetailProps {
  error: ConsoleError
  onClose: () => void
}

export function ConsoleErrorDetail({
  error,
  onClose,
}: ConsoleErrorDetailProps) {
  const [copied, setCopied] = useState(false)

  const copyErrorContext = async () => {
    const text = `## Console Error Report

**Type:** ${error.type}
**Message:** ${error.message}
${error.filename ? `**File:** ${error.filename}:${error.lineno || 0}:${error.colno || 0}` : ''}
**Page:** ${error.pageUrl}
**Time:** ${new Date(error.timestamp).toISOString()}

${error.stack ? `### Stack Trace
\`\`\`
${error.stack}
\`\`\`
` : ''}
---
Please help me debug this error. What could be causing it and how can I fix it?
`
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Drag Handle */}
      <div className="flex justify-center pt-3 pb-2">
        <div className="w-10 h-1 rounded-full bg-border" />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-500" />
          <span className="text-sm font-medium">Console Error</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={copyErrorContext}
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

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {/* Error Type */}
        <div>
          <p className="text-[10px] text-text-muted mb-1">Type</p>
          <span className={`text-xs px-2 py-1 rounded font-medium ${
            error.type === 'error' ? 'bg-red-100 text-red-700' :
            error.type === 'unhandledrejection' ? 'bg-amber-100 text-amber-700' :
            'bg-purple-100 text-purple-700'
          }`}>
            {error.type}
          </span>
        </div>

        {/* Message */}
        <div>
          <p className="text-[10px] text-text-muted mb-1">Message</p>
          <p className="text-sm bg-bg p-3 rounded-lg border border-border">
            {error.message}
          </p>
        </div>

        {/* Location */}
        {error.filename && (
          <div>
            <p className="text-[10px] text-text-muted mb-1">Location</p>
            <p className="text-xs font-mono bg-bg p-2 rounded-lg border border-border">
              {error.filename}
              {error.lineno && `:${error.lineno}`}
              {error.colno && `:${error.colno}`}
            </p>
          </div>
        )}

        {/* Stack Trace */}
        {error.stack && (
          <div>
            <p className="text-[10px] text-text-muted mb-1">Stack Trace</p>
            <pre className="text-xs font-mono whitespace-pre-wrap break-all bg-bg p-3 rounded-lg border border-border max-h-48 overflow-auto">
              {error.stack}
            </pre>
          </div>
        )}

        {/* Page Info */}
        <div>
          <p className="text-[10px] text-text-muted mb-1">Page</p>
          <p className="text-xs font-mono break-all bg-bg p-2 rounded-lg border border-border">
            {error.pageUrl}
          </p>
        </div>
      </div>
    </div>
  )
}
