import { History, X, Download, Trash2 } from 'lucide-react'
import type { Session } from '../../types'

interface SessionHistoryProps {
  sessions: Session[]
  onLoad: (id: string) => void
  onDelete: (id: string) => void
  onClose: () => void
}

export function SessionHistory({
  sessions,
  onLoad,
  onDelete,
  onClose,
}: SessionHistoryProps) {
  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp)
    return date.toLocaleString()
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-center pt-3 pb-2">
        <div className="w-10 h-1 rounded-full bg-border" />
      </div>

      <div className="flex items-center justify-between px-4 py-2 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-accent" />
          <span className="text-sm font-medium">Session History</span>
          <span className="text-xs text-text-muted">
            ({sessions.length} saved)
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 text-text-muted hover:text-text rounded hover:bg-hover"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-auto">
        {sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-text-muted">
            <History className="w-12 h-12 mb-3 opacity-30" strokeWidth={1} />
            <p className="text-sm">No saved sessions</p>
            <p className="text-xs mt-1">Save a session from the export menu</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {sessions.map(session => (
              <div key={session.id} className="px-4 py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text truncate">
                    {session.name}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-text-muted">
                      {formatDate(session.timestamp)}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-hover">
                      {session.count} requests
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => onLoad(session.id)}
                    className="flex items-center gap-1 px-2 py-1 text-xs bg-accent text-white rounded hover:opacity-90 transition-opacity"
                  >
                    <Download className="w-3 h-3" /> Load
                  </button>
                  <button
                    onClick={() => onDelete(session.id)}
                    className="p-1.5 text-red-500 hover:bg-red-50 rounded"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
