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
  notes?: string
}

export type TopologyNodeData =
  | VpsNodeData
  | ShapeNodeData
  | NoteNodeData
  | GroupNodeData

/** Тип связи на схеме инфраструктуры */
export type TopologyEdgeRelation =
  | 'network'
  | 'dependency'
  | 'tunnel'
  | 'vpn'
  | 'sync'
  | 'custom'

export type TopologyEdgeDirection = 'forward' | 'bidirectional' | 'none'

export type TopologyEdgeData = {
  relation: TopologyEdgeRelation
  label?: string
  lineStyle?: 'solid' | 'dashed'
  direction?: TopologyEdgeDirection
  protocol?: string
  notes?: string
}

export type TopologyFlowNode = Node<TopologyNodeData, TopologyNodeType>
export type TopologyFlowEdge = Edge<TopologyEdgeData>

export type PaletteItem =
  | { kind: 'shape'; shape: ShapeKind; label: string }
  | { kind: 'note'; label: string }
  | { kind: 'group'; label: string }
  | { kind: 'vps-picker'; label: string }

export const EDGE_RELATION_OPTIONS: { value: TopologyEdgeRelation; label: string }[] = [
  { value: 'network', label: 'Сеть / L2–L3' },
  { value: 'dependency', label: 'Зависимость сервиса' },
  { value: 'tunnel', label: 'Туннель' },
  { value: 'vpn', label: 'VPN' },
  { value: 'sync', label: 'Синхронизация / репликация' },
  { value: 'custom', label: 'Произвольная' },
]

export const EDGE_DIRECTION_OPTIONS: { value: TopologyEdgeDirection; label: string }[] = [
  { value: 'forward', label: 'Односторонняя →' },
  { value: 'bidirectional', label: 'Двусторонняя ↔' },
  { value: 'none', label: 'Без стрелок' },
]

export const SHAPE_KIND_OPTIONS: { value: ShapeKind; label: string }[] = [
  { value: 'rect', label: 'Прямоугольник' },
  { value: 'ellipse', label: 'Эллипс' },
  { value: 'diamond', label: 'Ромб' },
]

export function isVpsNodeData(data: TopologyNodeData): data is VpsNodeData {
  return 'vpsId' in data
}

export function isShapeNodeData(data: TopologyNodeData): data is ShapeNodeData {
  return 'kind' in data && 'label' in data && !('vpsId' in data) && !('text' in data)
}

export function isNoteNodeData(data: TopologyNodeData): data is NoteNodeData {
  return 'text' in data
}

export function isGroupNodeData(data: TopologyNodeData): data is GroupNodeData {
  return 'label' in data && !('kind' in data) && !('vpsId' in data) && !('text' in data)
}

export function defaultEdgeData(): TopologyEdgeData {
  return {
    relation: 'network',
    label: '',
    lineStyle: 'solid',
    direction: 'forward',
    protocol: '',
    notes: '',
  }
}

export function edgeRelationLabel(relation: TopologyEdgeRelation): string {
  return EDGE_RELATION_OPTIONS.find((o) => o.value === relation)?.label ?? relation
}

export function vpsSpecsLine(vps: Pick<Vps, 'vcpu' | 'ramGb' | 'diskGb' | 'diskType'>): string {
  const disk = vps.diskType ? `${vps.diskGb} ГБ ${vps.diskType}` : `${vps.diskGb} ГБ`
  return `${vps.vcpu} CPU · ${vps.ramGb} ГБ RAM · ${disk}`
}

export function newNodeId(prefix: string): string {
  // uid() falls back when crypto.randomUUID unavailable (HTTP non-localhost)
  return `${prefix}-${uid()}`
}
