import { useState, useCallback } from 'react'
import { Loader2, Eye } from 'lucide-react'
import type { UsageResult, ScanStatus } from '../../types'
import { JsonTreeNode } from './JsonTreeNode'

interface JsonTreeViewProps {
  data: unknown
  usageCache?: Map<string, UsageResult>
  onHighlight: (path: string, value: unknown) => void
  onScan: () => void
  scanStatus: ScanStatus
  progress: { scanned: number; total: number }
}

export function JsonTreeView({
  data,
  usageCache,
  onHighlight,
  onScan,
  scanStatus,
  progress,
}: JsonTreeViewProps) {
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set(['root']))

  const toggleExpanded = useCallback((path: string) => {
    setExpandedPaths(prev => {
      const next = new Set(prev)
      if (next.has(path)) {
        next.delete(path)
      } else {
        next.add(path)
      }
      return next
    })
  }, [])

  const expandAll = useCallback(() => {
    const allPaths = new Set<string>(['root'])
    const traverse = (obj: unknown, path: string) => {
      if (obj && typeof obj === 'object') {
        allPaths.add(path)
        Object.entries(obj as object).forEach(([key, value]) => {
          traverse(value, `${path}.${key}`)
        })
      }
    }
    traverse(data, 'root')
    setExpandedPaths(allPaths)
  }, [data])

  const collapseAll = useCallback(() => {
    setExpandedPaths(new Set(['root']))
  }, [])

  return (
    <div className="space-y-2">
      {/* Controls */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={onScan}
          disabled={scanStatus === 'scanning'}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg transition-colors border ${
            scanStatus === 'scanning'
              ? 'border-blue-300 bg-blue-50 text-blue-600'
              : scanStatus === 'complete'
                ? 'border-emerald-300 bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                : 'border-border hover:bg-hover'
          }`}
        >
          {scanStatus === 'scanning' ? (
            <>
              <Loader2 className="w-3 h-3 animate-spin" />
              Scanning ({progress.scanned}/{progress.total})
            </>
          ) : (
            <>
              <Eye className="w-3 h-3" />
              {scanStatus === 'complete' ? 'Rescan DOM' : 'Find in DOM'}
            </>
          )}
        </button>

        {scanStatus === 'complete' && usageCache && (
          <span className="text-[10px] text-text-muted">
            {Array.from(usageCache.values()).filter(u => u.count > 0).length} fields found in page
          </span>
        )}

        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={expandAll}
            className="px-2 py-1 text-[10px] text-text-muted hover:text-text hover:bg-hover rounded"
          >
            Expand all
          </button>
          <button
            onClick={collapseAll}
            className="px-2 py-1 text-[10px] text-text-muted hover:text-text hover:bg-hover rounded"
          >
            Collapse
          </button>
        </div>
      </div>

      {/* Tree */}
      <div
        className="bg-bg rounded-lg border border-border p-3 font-mono text-xs overflow-auto max-h-[60vh]"
        role="tree"
        aria-label="JSON response tree"
      >
        <JsonTreeNode
          keyName={null}
          value={data}
          path="root"
          depth={0}
          expandedPaths={expandedPaths}
          toggleExpanded={toggleExpanded}
          usageCache={usageCache}
          onHighlight={onHighlight}
        />
      </div>
    </div>
  )
}
