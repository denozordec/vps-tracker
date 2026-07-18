import { memo } from 'react'
import { Handle, Position, type NodeProps, NodeResizer } from '@xyflow/react'
import { cn } from '@cfdm/ui/lib/utils'
import type { ShapeNodeData } from '../types'

function ShapeNodeComponent({ data, selected }: NodeProps & { data: ShapeNodeData }) {
  const kind = data.kind ?? 'rect'
  return (
    <div
      className={cn(
        'flex min-h-[64px] min-w-[120px] items-center justify-center border bg-muted/40 px-3 py-2 text-sm',
        kind === 'ellipse' && 'rounded-full',
        kind === 'rect' && 'rounded-md',
        kind === 'diamond' && 'rotate-45 rounded-sm',
        selected ? 'border-primary ring-2 ring-primary/20' : 'border-border',
      )}
    >
      <NodeResizer minWidth={80} minHeight={48} isVisible={selected} />
      <Handle
        type="target"
        position={Position.Left}
        className="!size-2.5 !border-background !bg-muted-foreground"
      />
      <span className={cn('text-center text-xs font-medium', kind === 'diamond' && '-rotate-45')}>
        {data.label || 'Блок'}
      </span>
      <Handle
        type="source"
        position={Position.Right}
        className="!size-2.5 !border-background !bg-muted-foreground"
      />
    </div>
  )
}

export const ShapeNode = memo(ShapeNodeComponent)
