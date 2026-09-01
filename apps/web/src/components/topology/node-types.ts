import type { NodeTypes } from '@xyflow/react'
import { VpsNode } from './nodes/vps-node'
import { ShapeNode } from './nodes/shape-node'
import { NoteNode } from './nodes/note-node'
import { GroupNode } from './nodes/group-node'
import { ServiceNode } from './nodes/service-node'

export const topologyNodeTypes = {
  vps: VpsNode,
  shape: ShapeNode,
  note: NoteNode,
  group: GroupNode,
  service: ServiceNode,
} satisfies NodeTypes
