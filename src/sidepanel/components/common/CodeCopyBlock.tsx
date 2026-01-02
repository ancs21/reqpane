import { useState } from 'react'
import { Copy } from 'lucide-react'

interface CodeCopyBlockProps {
  label: string
  icon: React.ReactNode
  code: string
}

export function CodeCopyBlock({ label, icon, code }: CodeCopyBlockProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-hover">
        <div className="flex items-center gap-2 text-xs font-medium">
          {icon}
          {label}
        </div>
        <button
          onClick={handleCopy}
          className={`flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors ${
            copied
              ? 'bg-emerald-100 text-emerald-600'
              : 'bg-surface hover:bg-accent hover:text-white'
          }`}
        >
          <Copy className="w-3 h-3" />
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <pre className="p-3 text-xs font-mono whitespace-pre-wrap break-all bg-bg max-h-32 overflow-auto">
        {code}
      </pre>
    </div>
  )
}
