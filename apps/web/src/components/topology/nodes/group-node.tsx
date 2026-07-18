import { memo } from 'react'
import { type NodeProps, NodeResizer } from '@xyflow/react'
import { cn } from '@cfdm/ui/lib/utils'
import type { GroupNodeData } from '../types'

function GroupNodeComponent({ data, selected }: NodeProps & { data: GroupNodeData }) {
  return (
    <div
      className={cn(
        'h-full min-h-[160px] min-w-[280px] rounded-lg border-2 border-dashed bg-muted/20',
        selected ? 'border-primary' : 'border-border',
      )}
    >
      <NodeResizer minWidth={200} minHeight={120} isVisible={selected} />
      <div className="flex flex-col gap-0.5 px-3 py-2">
        <div className="text-xs font-medium text-foreground">
          {data.label || 'Группа'}
        </div>
        {data.notes ? (
          <div className="text-[10px] text-muted-foreground whitespace-pre-wrap">
            {data.notes}
          </div>
        ) : null}
      </div>
    </div>
  )
}

export const GroupNode = memo(GroupNodeComponent)
