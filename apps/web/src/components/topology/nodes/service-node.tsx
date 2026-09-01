import { memo } from 'react'
import { type NodeProps } from '@xyflow/react'
import { NetworkIcon } from 'lucide-react'
import { cn } from '@cfdm/ui/lib/utils'
import { Badge } from '@/components/reui/badge'
import { lbModeBadgeVariant, lbModeLabel, type ServiceNodeData } from '../types'
import { NodeSideHandles } from './node-side-handles'

function ServiceNodeComponent({ data, selected }: NodeProps & { data: ServiceNodeData }) {
  return (
    <div
      className={cn(
        'relative min-w-[200px] max-w-[280px] rounded-lg border bg-background px-3 py-2 shadow-sm',
        selected ? 'border-primary ring-2 ring-primary/20' : 'border-border',
      )}
    >
      <NodeSideHandles />
      <div className="flex items-start gap-2">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted">
          <NetworkIcon className="size-4 text-muted-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-sm font-medium">{data.label || 'Сервис'}</span>
            {data.lbMode ? (
              <Badge variant={lbModeBadgeVariant(data.lbMode)} size="xs">
                {lbModeLabel(data.lbMode)}
              </Badge>
            ) : null}
          </div>
          {data.fqdn ? (
            <div className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
              {data.fqdn}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export const ServiceNode = memo(ServiceNodeComponent)
