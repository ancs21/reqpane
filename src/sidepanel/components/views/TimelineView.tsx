import type { ApiRequest } from '../../types'

interface TimelineViewProps {
  requests: ApiRequest[]
  selectedRequest: ApiRequest | null
  onSelect: (req: ApiRequest) => void
}

export function TimelineView({
  requests,
  selectedRequest,
  onSelect,
}: TimelineViewProps) {
  if (requests.length === 0) return null

  // Sort requests chronologically (earliest first) for waterfall view
  const sortedRequests = [...requests].sort((a, b) => a.timestamp - b.timestamp)

  // Find the earliest timestamp and latest end time
  const startTime = Math.min(...requests.map(r => r.timestamp))
  const endTime = Math.max(...requests.map(r => r.timestamp + r.duration))
  const totalDuration = endTime - startTime || 1

  const getMethodColor = (method: string) => {
    switch (method) {
      case 'GET': return 'bg-emerald-500'
      case 'POST': return 'bg-blue-500'
      case 'PUT': return 'bg-amber-500'
      case 'PATCH': return 'bg-orange-500'
      case 'DELETE': return 'bg-red-500'
      default: return 'bg-gray-500'
    }
  }

  const getStatusColor = (status: number, error: string | null) => {
    if (error || status === 0) return 'bg-red-500'
    if (status < 300) return 'bg-emerald-500'
    if (status < 400) return 'bg-amber-500'
    return 'bg-red-500'
  }

  return (
    <div className="p-3 space-y-1">
      {/* Timeline header */}
      <div className="flex items-center justify-between mb-3 text-[10px] text-text-muted">
        <span>0ms</span>
        <span>{Math.round(totalDuration)}ms</span>
      </div>

      {/* Timeline bars */}
      {sortedRequests.map(req => {
        const offset = ((req.timestamp - startTime) / totalDuration) * 100
        const width = Math.max((req.duration / totalDuration) * 100, 1) // At least 1% width

        // Extract pathname from URL
        let pathname = req.url
        try {
          pathname = new URL(req.url).pathname
          // Truncate long paths
          if (pathname.length > 40) {
            pathname = '...' + pathname.slice(-37)
          }
        } catch {
          // Keep original if URL parsing fails
        }

        return (
          <button
            key={req.id}
            onClick={() => onSelect(req)}
            className={`w-full flex items-center gap-2 p-2 rounded-lg transition-colors text-left ${
              selectedRequest?.id === req.id ? 'bg-accent-light' : 'hover:bg-hover'
            }`}
          >
            {/* Method badge */}
            <span className={`text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded text-white shrink-0 ${getMethodColor(req.method)}`}>
              {req.method}
            </span>

            {/* URL path */}
            <span className="text-[10px] text-text-muted truncate w-32 shrink-0" title={req.url}>
              {pathname}
            </span>

            {/* Timeline bar container */}
            <div className="flex-1 relative h-6 bg-surface rounded border border-border min-w-[100px]">
              {/* The bar */}
              <div
                className={`absolute top-1 bottom-1 rounded ${getStatusColor(req.status, req.error)} opacity-80`}
                style={{
                  left: `${offset}%`,
                  width: `${width}%`,
                  minWidth: '4px',
                }}
              />
              {/* Duration label */}
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-text-muted">
                {req.duration}ms
              </span>
            </div>

            {/* Status */}
            <span className={`text-[10px] font-mono w-8 text-right shrink-0 ${
              req.status >= 400 || req.error ? 'text-red-500' : 'text-emerald-600'
            }`}>
              {req.status || 'ERR'}
            </span>
          </button>
        )
      })}

      {/* Legend */}
      <div className="flex items-center gap-4 pt-3 border-t border-border text-[10px] text-text-muted">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-emerald-500" /> 2xx
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-amber-500" /> 3xx
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-red-500" /> 4xx/5xx
        </div>
      </div>
    </div>
  )
}
