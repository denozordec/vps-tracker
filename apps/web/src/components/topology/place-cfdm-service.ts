import type { CfdmTopologyService } from './cfdm-services'
import { serviceFqdnMeta } from './cfdm-services'
import { createMembershipEdge } from './edge-utils'
import { applyMembershipHandles } from './membership-handles'
import { detachNodeFromGroup, normalizeGroupLayers, sortParentsFirst } from './group-utils'
import {
  isGroupNodeData,
  isServiceNodeData,
  isVpsNodeData,
  newNodeId,
  type TopologyFlowEdge,
  type TopologyFlowNode,
  type ServiceNodeData,
} from './types'

const CELL_W = 240
const CELL_H = 110
const SERVICE_GAP_Y = 120

export type PlaceCfdmServiceResult = {
  nodes: TopologyFlowNode[]
  edges: TopologyFlowEdge[]
  alreadyOnCanvas: boolean
}

function existingServiceNode(
  nodes: TopologyFlowNode[],
  serviceId: number,
): TopologyFlowNode | undefined {
  return nodes.find(
    (n) => n.type === 'service' && isServiceNodeData(n.data) && n.data.cfdmServiceId === serviceId,
  )
}

function existingVpsNode(
  nodes: TopologyFlowNode[],
  vpsId: string,
): TopologyFlowNode | undefined {
  return nodes.find((n) => n.type === 'vps' && isVpsNodeData(n.data) && n.data.vpsId === vpsId)
}

function hasMembership(
  edges: TopologyFlowEdge[],
  serviceNodeId: string,
  vpsNodeId: string,
): boolean {
  return edges.some(
    (e) =>
      e.data?.relation === 'membership' &&
      e.source === serviceNodeId &&
      e.target === vpsNodeId,
  )
}

function serviceNodeData(service: CfdmTopologyService): ServiceNodeData {
  const { fqdn, extraFqdns } = serviceFqdnMeta(service)
  return {
    label: service.name,
    cfdmServiceId: service.serviceId,
    fqdn,
    extraFqdns: extraFqdns.length > 0 ? extraFqdns : undefined,
    lbMode: service.lbMode,
  }
}

/** Ставит сервис CFDM как отдельный узел и пунктирные рёбра членства к VPS. */
export function placeCfdmService(
  nodes: TopologyFlowNode[],
  edges: TopologyFlowEdge[],
  service: CfdmTopologyService,
  origin: { x: number; y: number },
): PlaceCfdmServiceResult {
  const already = existingServiceNode(nodes, service.serviceId)
  if (already) {
    return { nodes, edges, alreadyOnCanvas: true }
  }

  const serviceId = newNodeId('service')
  const serviceNode: TopologyFlowNode = {
    id: serviceId,
    type: 'service',
    position: origin,
    data: serviceNodeData(service),
  }

  let nextNodes = [...nodes, serviceNode]
  let nextEdges = [...edges]

  service.matchedVpsIds.forEach((vpsId, i) => {
    let vpsNode = existingVpsNode(nextNodes, vpsId)
    if (!vpsNode) {
      vpsNode = {
        id: newNodeId('vps'),
        type: 'vps',
        position: {
          x: origin.x + i * CELL_W,
          y: origin.y + SERVICE_GAP_Y,
        },
        data: { vpsId },
      }
      nextNodes = [...nextNodes, vpsNode]
    }
    if (!hasMembership(nextEdges, serviceId, vpsNode.id)) {
      nextEdges = [...nextEdges, createMembershipEdge(serviceId, vpsNode.id)]
    }
  })

  return {
    nodes: normalizeGroupLayers(sortParentsFirst(nextNodes)),
    edges: applyMembershipHandles(nextEdges, nextNodes),
    alreadyOnCanvas: false,
  }
}

export function placeCfdmServices(
  nodes: TopologyFlowNode[],
  edges: TopologyFlowEdge[],
  services: CfdmTopologyService[],
  origin: { x: number; y: number },
): { nodes: TopologyFlowNode[]; edges: TopologyFlowEdge[]; alreadyIds: number[] } {
  let nextNodes = nodes
  let nextEdges = edges
  const alreadyIds: number[] = []
  services.forEach((service, i) => {
    const result = placeCfdmService(nextNodes, nextEdges, service, {
      x: origin.x,
      y: origin.y + i * (SERVICE_GAP_Y + CELL_H),
    })
    nextNodes = result.nodes
    nextEdges = result.edges
    if (result.alreadyOnCanvas) alreadyIds.push(service.serviceId)
  })
  return { nodes: nextNodes, edges: nextEdges, alreadyIds }
}

function compactServiceNode(node: TopologyFlowNode): TopologyFlowNode {
  if (node.type !== 'service') return node
  if (node.style == null && node.width == null && node.height == null && node.measured == null) {
    return node
  }
  const { style: _style, width: _width, height: _height, measured: _measured, ...rest } = node
  return rest
}

function compactServiceFromGroup(
  group: TopologyFlowNode,
  service: CfdmTopologyService | undefined,
): TopologyFlowNode {
  const data = isGroupNodeData(group.data) ? group.data : undefined
  const { fqdn, extraFqdns } = service ? serviceFqdnMeta(service) : { fqdn: '', extraFqdns: [] }
  const nextData: ServiceNodeData = {
    label: data?.label ?? service?.name ?? 'Сервис',
    cfdmServiceId: data?.cfdmServiceId ?? service?.serviceId ?? 0,
    fqdn,
    extraFqdns: extraFqdns.length > 0 ? extraFqdns : undefined,
    lbMode: data?.lbMode ?? service?.lbMode,
  }
  const { style: _style, width: _w, height: _h, measured: _m, ...rest } = group
  return {
    ...rest,
    type: 'service',
    data: nextData,
  }
}

/**
 * Одноразовая миграция: CFDM dashed-группа + parentId → узел service + membership.
 * Идемпотентна: уже `type: 'service'` не трогает.
 */
export function migrateCfdmGroupsToServices(
  nodes: TopologyFlowNode[],
  edges: TopologyFlowEdge[],
  services: CfdmTopologyService[],
): { nodes: TopologyFlowNode[]; edges: TopologyFlowEdge[]; changed: boolean } {
  const byServiceId = new Map(services.map((s) => [s.serviceId, s]))
  const groups = nodes.filter(
    (n) => n.type === 'group' && isGroupNodeData(n.data) && n.data.cfdmServiceId != null,
  )
  if (groups.length === 0) {
    const compacted = nodes.map(compactServiceNode)
    const withMeta = applyServiceFqdns(compacted, services)
    const nextEdges = applyMembershipHandles(edges, withMeta)
    const changed =
      compacted.some((n, i) => n !== nodes[i]) ||
      withMeta !== compacted ||
      nextEdges !== edges
    return { nodes: withMeta, edges: nextEdges, changed }
  }

  let nextNodes = nodes
  let nextEdges = edges
  let changed = false

  for (const group of groups) {
    if (!isGroupNodeData(group.data) || group.data.cfdmServiceId == null) continue
    const service = byServiceId.get(group.data.cfdmServiceId)
    const children = nextNodes.filter((n) => n.parentId === group.id && n.type === 'vps')
    for (const child of children) {
      const detached = detachNodeFromGroup(child, nextNodes)
      nextNodes = nextNodes.map((n) => (n.id === child.id ? detached : n))
      if (!hasMembership(nextEdges, group.id, detached.id)) {
        nextEdges = [...nextEdges, createMembershipEdge(group.id, detached.id)]
      }
      changed = true
    }
    const converted = compactServiceFromGroup(group, service)
    nextNodes = nextNodes.map((n) => (n.id === group.id ? converted : n))
    changed = true
  }

  return {
    nodes: normalizeGroupLayers(sortParentsFirst(nextNodes)),
    edges: applyMembershipHandles(nextEdges, nextNodes),
    changed,
  }
}

/** Подставляет FQDN/lbMode из агрегата, не меняя позиции. */
export function applyServiceFqdns(
  nodes: TopologyFlowNode[],
  services: CfdmTopologyService[],
): TopologyFlowNode[] {
  if (services.length === 0) return nodes
  const byId = new Map(services.map((s) => [s.serviceId, s]))
  let changed = false
  const next = nodes.map((n) => {
    if (n.type !== 'service' || !isServiceNodeData(n.data)) return n
    const service = byId.get(n.data.cfdmServiceId)
    if (!service) return n
    const { fqdn, extraFqdns } = serviceFqdnMeta(service)
    const extra = extraFqdns.length > 0 ? extraFqdns : undefined
    if (
      n.data.fqdn === fqdn &&
      n.data.lbMode === service.lbMode &&
      JSON.stringify(n.data.extraFqdns) === JSON.stringify(extra)
    ) {
      return n
    }
    changed = true
    return {
      ...n,
      data: {
        ...n.data,
        fqdn,
        extraFqdns: extra,
        lbMode: service.lbMode,
      },
    }
  })
  return changed ? next : nodes
}
