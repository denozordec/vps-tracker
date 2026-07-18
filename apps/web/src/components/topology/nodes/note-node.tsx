import { memo } from 'react'
import { type NodeProps, NodeResizer } from '@xyflow/react'
import { cn } from '@cfdm/ui/lib/utils'
import type { NoteNodeData } from '../types'

function NoteNodeComponent({ data, selected }: NodeProps & { data: NoteNodeData }) {
  return (
    <div
      className={cn(
        'min-h-[72px] min-w-[140px] rounded-md border border-dashed bg-warning/10 px-3 py-2 text-xs whitespace-pre-wrap',
        selected ? 'border-primary ring-2 ring-primary/20' : 'border-warning/40',
      )}
    >
      <NodeResizer minWidth={100} minHeight={56} isVisible={selected} />
      {data.text || 'Заметка'}
    </div>
  )
}

export const NoteNode = memo(NoteNodeComponent)
