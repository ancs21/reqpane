import { AlertTriangle } from 'lucide-react'
import type { ConsoleError } from '../../types'

interface ConsoleErrorRowProps {
  error: ConsoleError
  isSelected: boolean
  onClick: () => void
}

export function ConsoleErrorRow({
  error,
  isSelected,
  onClick,
}: ConsoleErrorRowProps) {
  const getErrorTypeLabel = (type: string) => {
    switch (type) {
      case 'error': return 'Error'
      case 'unhandledrejection': return 'Promise'
      case 'console.error': return 'Console'
      default: return 'Error'
    }
  }

  const getErrorTypeColor = (type: string) => {
    switch (type) {
      case 'error': return 'bg-red-100 text-red-700'
      case 'unhandledrejection': return 'bg-amber-100 text-amber-700'
      case 'console.error': return 'bg-purple-100 text-purple-700'
      default: return 'bg-red-100 text-red-700'
    }
  }

  const timeAgo = (timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000)
    if (seconds < 60) return `${seconds}s ago`
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    return `${hours}h ago`
  }

  return (
    <button
      onClick={onClick}
      className={`w-full px-4 py-3 text-left transition-colors ${
        isSelected ? 'bg-accent-light' : 'hover:bg-hover'
      }`}
    >
      <div className="flex items-center gap-2 mb-1">
        <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${getErrorTypeColor(error.type)}`}>
          {getErrorTypeLabel(error.type)}
        </span>
        <span className="text-[10px] text-text-muted">
          {timeAgo(error.timestamp)}
        </span>
        {error.filename && (
          <span className="text-[10px] text-text-muted truncate max-w-[120px]">
            {error.filename.split('/').pop()}
            {error.lineno && `:${error.lineno}`}
          </span>
        )}
      </div>
      <p className="text-xs text-text line-clamp-2">
        {error.message}
      </p>
    </button>
  )
}
