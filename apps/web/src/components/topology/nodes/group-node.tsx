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
      <div className="px-3 py-2 text-xs font-medium text-muted-foreground">
        {data.label || 'Группа'}
      </div>
    </div>
  )
}

export const GroupNode = memo(GroupNodeComponent)
