import { Handle, Position } from '@xyflow/react'

const HANDLE_CLASS = '!size-2.5 !border-background !bg-muted-foreground'

/** Четыре стороны; ConnectionMode.Loose позволяет стартовать и заканчивать на любой. */
export function NodeSideHandles() {
  return (
    <>
      <Handle type="source" position={Position.Top} id="top" className={HANDLE_CLASS} />
      <Handle type="source" position={Position.Right} id="right" className={HANDLE_CLASS} />
      <Handle type="source" position={Position.Bottom} id="bottom" className={HANDLE_CLASS} />
      <Handle type="source" position={Position.Left} id="left" className={HANDLE_CLASS} />
    </>
  )
}
