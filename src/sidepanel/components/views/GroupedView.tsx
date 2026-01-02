import { Collapsible } from '@base-ui-components/react/collapsible'
import { ChevronDown, FolderOpen } from 'lucide-react'
import type { ApiRequest } from '../../types'
import { RequestRow } from '../requests/RequestRow'

interface GroupedViewProps {
  groupedRequests: Record<string, ApiRequest[]>
  selectedRequest: ApiRequest | null
  favorites: string[]
  compareMode: boolean
  compareRequests: [ApiRequest | null, ApiRequest | null]
  onSelect: (req: ApiRequest) => void
  onToggleFavorite: (id: string) => void
  onToggleCompare: (req: ApiRequest) => void
}

export function GroupedView({
  groupedRequests,
  selectedRequest,
  favorites,
  compareMode,
  compareRequests,
  onSelect,
  onToggleFavorite,
  onToggleCompare,
}: GroupedViewProps) {
  const domains = Object.keys(groupedRequests).sort()

  return (
    <div className="divide-y divide-border">
      {domains.map(domain => (
        <Collapsible.Root key={domain} defaultOpen>
          <Collapsible.Trigger className="w-full flex items-center gap-2 px-4 py-2.5 bg-surface hover:bg-hover transition-colors">
            <ChevronDown className="w-4 h-4 text-text-muted [[data-state=closed]_&]:rotate-[-90deg] transition-transform" />
            <FolderOpen className="w-4 h-4 text-accent" />
            <span className="flex-1 text-left text-sm font-medium truncate">{domain}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-hover text-text-muted">
              {groupedRequests[domain].length}
            </span>
          </Collapsible.Trigger>
          <Collapsible.Panel>
            <div className="divide-y divide-border">
              {groupedRequests[domain].map(req => (
                <RequestRow
                  key={req.id}
                  request={req}
                  isSelected={selectedRequest?.id === req.id}
                  isFavorite={favorites.includes(req.id)}
                  compareMode={compareMode}
                  isCompareSelected={compareRequests[0]?.id === req.id || compareRequests[1]?.id === req.id}
                  onClick={() => onSelect(req)}
                  onToggleFavorite={() => onToggleFavorite(req.id)}
                  onToggleCompare={() => onToggleCompare(req)}
                />
              ))}
            </div>
          </Collapsible.Panel>
        </Collapsible.Root>
      ))}
    </div>
  )
}
