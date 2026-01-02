import { ChevronRight } from 'lucide-react'
import type { UsageResult } from '../../types'
import { getValueType } from '../../utils'

interface JsonTreeNodeProps {
  keyName: string | number | null
  value: unknown
  path: string
  depth: number
  expandedPaths: Set<string>
  toggleExpanded: (path: string) => void
  usageCache?: Map<string, UsageResult>
  onHighlight: (path: string, value: unknown) => void
}

export function JsonTreeNode({
  keyName,
  value,
  path,
  depth,
  expandedPaths,
  toggleExpanded,
  usageCache,
  onHighlight,
}: JsonTreeNodeProps) {
  const isExpanded = expandedPaths.has(path)
  const valueType = getValueType(value)
  const isExpandable = valueType === 'object' || valueType === 'array'
  const usage = usageCache?.get(path)

  const childEntries = isExpandable ? Object.entries(value as object) : []
  const childCount = childEntries.length

  // Get syntax highlighting color for value
  const getValueColor = () => {
    switch (valueType) {
      case 'string': return 'text-emerald-600'
      case 'number': return 'text-blue-600'
      case 'boolean': return 'text-purple-600'
      case 'null': return 'text-gray-400'
      default: return 'text-text'
    }
  }

  // Format value for display
  const formatValue = () => {
    if (valueType === 'string') {
      const str = value as string
      if (str.length > 80) {
        return `"${str.slice(0, 80)}..."`
      }
      return `"${str}"`
    }
    if (valueType === 'null') return 'null'
    if (valueType === 'boolean') return value ? 'true' : 'false'
    if (valueType === 'number') return String(value)
    if (valueType === 'array') return isExpanded ? '[' : `[${childCount}]`
    if (valueType === 'object') return isExpanded ? '{' : `{${childCount}}`
    return String(value)
  }

  return (
    <div role="treeitem" aria-expanded={isExpandable ? isExpanded : undefined}>
      <div
        className={`flex items-center gap-1 py-0.5 rounded hover:bg-hover cursor-pointer group`}
        style={{ paddingLeft: `${depth * 16}px` }}
        onClick={() => isExpandable && toggleExpanded(path)}
      >
        {/* Expand toggle */}
        {isExpandable ? (
          <ChevronRight
            className={`w-3 h-3 text-text-muted transition-transform ${isExpanded ? 'rotate-90' : ''}`}
          />
        ) : (
          <span className="w-3" />
        )}

        {/* Key name */}
        {keyName !== null && (
          <>
            <span className="text-accent">
              {typeof keyName === 'string' ? `"${keyName}"` : `[${keyName}]`}
            </span>
            <span className="text-text-muted">:</span>
          </>
        )}

        {/* Value */}
        <span className={getValueColor()}>
          {formatValue()}
        </span>

        {/* Usage indicator */}
        {usageCache && !isExpandable && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onHighlight(path, value)
            }}
            className={`ml-auto px-1.5 py-0.5 text-[10px] rounded transition-colors ${
              usage === undefined
                ? 'bg-gray-100 text-gray-400'
                : usage.count > 0
                  ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                  : 'bg-amber-50 text-amber-600'
            }`}
            title={
              usage === undefined
                ? 'Not scanned'
                : usage.count > 0
                  ? `Found ${usage.count} time(s) - Click to highlight`
                  : 'Not found in DOM'
            }
          >
            {usage === undefined ? '?' : usage.count}
          </button>
        )}
      </div>

      {/* Children */}
      {isExpandable && isExpanded && (
        <div role="group">
          {childEntries.map(([childKey, childValue], idx) => (
            <JsonTreeNode
              key={childKey}
              keyName={valueType === 'array' ? idx : childKey}
              value={childValue}
              path={`${path}.${childKey}`}
              depth={depth + 1}
              expandedPaths={expandedPaths}
              toggleExpanded={toggleExpanded}
              usageCache={usageCache}
              onHighlight={onHighlight}
            />
          ))}
          {/* Closing bracket */}
          <div style={{ paddingLeft: `${depth * 16}px` }} className="text-text-muted">
            {valueType === 'array' ? ']' : '}'}
          </div>
        </div>
      )}
    </div>
  )
}
