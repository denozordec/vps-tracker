import type { Edge, Node } from '@xyflow/react'
import type { Vps } from '@/types/entities'
import { uid } from '@/lib/format'

export type TopologyNodeType = 'vps' | 'shape' | 'note' | 'group'

export type ShapeKind = 'rect' | 'ellipse' | 'diamond'

export type VpsNodeData = {
  vpsId: string
  label?: string
}

export type ShapeNodeData = {
  kind: ShapeKind
  label: string
}

export type NoteNodeData = {
  text: string
}

export type GroupNodeData = {
  label: string
}

export type TopologyNodeData =
  | VpsNodeData
  | ShapeNodeData
  | NoteNodeData
  | GroupNodeData

export type TopologyFlowNode = Node<TopologyNodeData, TopologyNodeType>
export type TopologyFlowEdge = Edge

export type PaletteItem =
  | { kind: 'shape'; shape: ShapeKind; label: string }
  | { kind: 'note'; label: string }
  | { kind: 'group'; label: string }
  | { kind: 'vps-picker'; label: string }

export function isVpsNodeData(data: TopologyNodeData): data is VpsNodeData {
  return 'vpsId' in data
}

export function vpsSpecsLine(vps: Pick<Vps, 'vcpu' | 'ramGb' | 'diskGb' | 'diskType'>): string {
  const disk = vps.diskType ? `${vps.diskGb} ГБ ${vps.diskType}` : `${vps.diskGb} ГБ`
  return `${vps.vcpu} CPU · ${vps.ramGb} ГБ RAM · ${disk}`
}

export function newNodeId(prefix: string): string {
  // uid() falls back when crypto.randomUUID unavailable (HTTP non-localhost)
  return `${prefix}-${uid()}`
}
