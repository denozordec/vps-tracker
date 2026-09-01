import type { CfdmTopologyService } from './cfdm-services'
import { attachNodeToGroup, normalizeGroupLayers, sortParentsFirst } from './group-utils'
import {
  isGroupNodeData,
  isVpsNodeData,
  newNodeId,
  type TopologyFlowNode,
} from './types'

const PAD_X = 20
const PAD_Y = 44
const CELL_W = 240
const CELL_H = 110

export type PlaceCfdmServiceResult = {
  nodes: TopologyFlowNode[]
  skippedVpsIds: string[]
  alreadyOnCanvas: boolean
}

function cfdmGroupOf(
  node: TopologyFlowNode,
  nodes: TopologyFlowNode[],
): TopologyFlowNode | undefined {
  if (!node.parentId) return undefined
  const parent = nodes.find((n) => n.id === node.parentId)
  if (!parent || parent.type !== 'group' || !isGroupNodeData(parent.data)) return undefined
  if (parent.data.cfdmServiceId == null) return undefined
  return parent
}

function existingVpsNode(
  nodes: TopologyFlowNode[],
  vpsId: string,
): TopologyFlowNode | undefined {
  return nodes.find((n) => n.type === 'vps' && isVpsNodeData(n.data) && n.data.vpsId === vpsId)
}

/** Ставит сервис CFDM как существующую dashed-группу с VPS-детьми. */
export function placeCfdmServiceGroup(
  nodes: TopologyFlowNode[],
  service: CfdmTopologyService,
  origin: { x: number; y: number },
): PlaceCfdmServiceResult {
  const already = nodes.some(
    (n) =>
      n.type === 'group' &&
      isGroupNodeData(n.data) &&
      n.data.cfdmServiceId === service.serviceId,
  )
  if (already) {
    return { nodes, skippedVpsIds: [], alreadyOnCanvas: true }
  }

  const skippedVpsIds: string[] = []
  const vpsIds: string[] = []
  for (const vpsId of service.matchedVpsIds) {
    const existing = existingVpsNode(nodes, vpsId)
    if (existing) {
      const other = cfdmGroupOf(existing, nodes)
      if (other && isGroupNodeData(other.data) && other.data.cfdmServiceId !== service.serviceId) {
        skippedVpsIds.push(vpsId)
        continue
      }
    }
    vpsIds.push(vpsId)
  }

  if (vpsIds.length === 0) {
    return { nodes, skippedVpsIds, alreadyOnCanvas: false }
  }

  const width = PAD_X * 2 + vpsIds.length * CELL_W - (CELL_W - 220)
  const height = PAD_Y + CELL_H + 16
  const groupId = newNodeId('group')
  const group: TopologyFlowNode = {
    id: groupId,
    type: 'group',
    position: origin,
    style: { width, height },
    width,
    height,
    data: {
      label: service.name,
      cfdmServiceId: service.serviceId,
      lbMode: service.lbMode,
    },
    zIndex: -1,
  }

  let next = [...nodes, group]

  vpsIds.forEach((vpsId, i) => {
    const abs = {
      x: origin.x + PAD_X + i * CELL_W,
      y: origin.y + PAD_Y,
    }
    const existing = existingVpsNode(next, vpsId)
    if (existing) {
      const detached: TopologyFlowNode = {
        ...existing,
        parentId: undefined,
        position: abs,
      }
      const attached = attachNodeToGroup(detached, group, next)
      next = next.map((n) => (n.id === existing.id ? attached : n))
      return
    }
    const draft: TopologyFlowNode = {
      id: newNodeId('vps'),
      type: 'vps',
      position: abs,
      data: { vpsId },
    }
    next = [...next, attachNodeToGroup(draft, group, next)]
  })

  return {
    nodes: normalizeGroupLayers(sortParentsFirst(next)),
    skippedVpsIds,
    alreadyOnCanvas: false,
  }
}

export function placeCfdmServices(
  nodes: TopologyFlowNode[],
  services: CfdmTopologyService[],
  origin: { x: number; y: number },
): { nodes: TopologyFlowNode[]; skippedVpsIds: string[]; alreadyIds: number[] } {
  let next = nodes
  const skippedVpsIds: string[] = []
  const alreadyIds: number[] = []
  services.forEach((service, i) => {
    const result = placeCfdmServiceGroup(next, service, {
      x: origin.x,
      y: origin.y + i * 220,
    })
    next = result.nodes
    skippedVpsIds.push(...result.skippedVpsIds)
    if (result.alreadyOnCanvas) alreadyIds.push(service.serviceId)
  })
  return { nodes: next, skippedVpsIds, alreadyIds }
}
