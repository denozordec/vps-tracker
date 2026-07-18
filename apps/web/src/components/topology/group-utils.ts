import type { TopologyFlowNode, TopologyNodeType } from './types'

const GROUP_Z = -1
const CONTENT_Z = 1

const ATTACHABLE = new Set<TopologyNodeType>(['vps', 'shape', 'note'])

export function isAttachableType(type: TopologyNodeType | undefined): boolean {
  return type != null && ATTACHABLE.has(type)
}

export function normalizeGroupLayers(nodes: TopologyFlowNode[]): TopologyFlowNode[] {
  return nodes.map((n) => {
    if (n.type === 'group') {
      return { ...n, zIndex: n.selected ? 0 : GROUP_Z }
    }
    if (n.zIndex != null && n.zIndex < CONTENT_Z) {
      return { ...n, zIndex: CONTENT_Z }
    }
    return n.zIndex == null ? { ...n, zIndex: CONTENT_Z } : n
  })
}

function nodeWidth(node: TopologyFlowNode): number {
  return (
    node.measured?.width ??
    (typeof node.width === 'number' ? node.width : undefined) ??
    (typeof node.style?.width === 'number' ? node.style.width : undefined) ??
    (typeof node.style?.width === 'string' ? Number.parseFloat(node.style.width) : undefined) ??
    220
  )
}

function nodeHeight(node: TopologyFlowNode): number {
  return (
    node.measured?.height ??
    (typeof node.height === 'number' ? node.height : undefined) ??
    (typeof node.style?.height === 'number' ? node.style.height : undefined) ??
    (typeof node.style?.height === 'string' ? Number.parseFloat(node.style.height) : undefined) ??
    80
  )
}

function absolutePosition(
  node: TopologyFlowNode,
  nodesById: Map<string, TopologyFlowNode>,
): { x: number; y: number } {
  let x = node.position.x
  let y = node.position.y
  let parentId = node.parentId
  const guard = new Set<string>()
  while (parentId && !guard.has(parentId)) {
    guard.add(parentId)
    const parent = nodesById.get(parentId)
    if (!parent) break
    x += parent.position.x
    y += parent.position.y
    parentId = parent.parentId
  }
  return { x, y }
}

export function getNodeCenterAbsolute(
  node: TopologyFlowNode,
  nodes: TopologyFlowNode[],
): { x: number; y: number } {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const abs = absolutePosition(node, byId)
  return {
    x: abs.x + nodeWidth(node) / 2,
    y: abs.y + nodeHeight(node) / 2,
  }
}

function groupBounds(group: TopologyFlowNode, nodesById: Map<string, TopologyFlowNode>) {
  const abs = absolutePosition(group, nodesById)
  return { x: abs.x, y: abs.y, width: nodeWidth(group), height: nodeHeight(group) }
}

function pointInBounds(
  point: { x: number; y: number },
  bounds: { x: number; y: number; width: number; height: number },
): boolean {
  return (
    point.x >= bounds.x &&
    point.x <= bounds.x + bounds.width &&
    point.y >= bounds.y &&
    point.y <= bounds.y + bounds.height
  )
}

/** Найти группу, в чьи bounds попадает точка (предпочитаем наименьшую площадь). */
export function findGroupAtPoint(
  nodes: TopologyFlowNode[],
  point: { x: number; y: number },
  excludeId?: string,
): TopologyFlowNode | null {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  let best: TopologyFlowNode | null = null
  let bestArea = Number.POSITIVE_INFINITY

  for (const n of nodes) {
    if (n.type !== 'group' || n.id === excludeId) continue
    const b = groupBounds(n, byId)
    if (!pointInBounds(point, b)) continue
    const area = b.width * b.height
    if (area < bestArea) {
      best = n
      bestArea = area
    }
  }
  return best
}

export function attachNodeToGroup(
  node: TopologyFlowNode,
  group: TopologyFlowNode,
  nodes: TopologyFlowNode[],
): TopologyFlowNode {
  if (node.id === group.id) return node
  if (node.parentId === group.id) {
    return {
      ...node,
      parentId: group.id,
      extent: 'parent',
      zIndex: CONTENT_Z,
    }
  }
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const abs = absolutePosition(node, byId)
  const groupAbs = absolutePosition(group, byId)
  return {
    ...node,
    parentId: group.id,
    extent: 'parent',
    position: {
      x: abs.x - groupAbs.x,
      y: abs.y - groupAbs.y,
    },
    zIndex: CONTENT_Z,
  }
}

export function detachNodeFromGroup(
  node: TopologyFlowNode,
  nodes: TopologyFlowNode[],
): TopologyFlowNode {
  if (!node.parentId) {
    return { ...node, extent: undefined, zIndex: CONTENT_Z }
  }
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const abs = absolutePosition(node, byId)
  return {
    ...node,
    parentId: undefined,
    extent: undefined,
    position: abs,
    zIndex: CONTENT_Z,
  }
}

/** Применить attach/detach по центру узла после drag. */
export function reconcileNodeParenting(
  node: TopologyFlowNode,
  nodes: TopologyFlowNode[],
): TopologyFlowNode {
  if (!isAttachableType(node.type)) return node

  const center = getNodeCenterAbsolute(node, nodes)
  const group = findGroupAtPoint(nodes, center, node.id)

  if (group) {
    return attachNodeToGroup(node, group, nodes)
  }
  if (node.parentId) {
    return detachNodeFromGroup(node, nodes)
  }
  return node
}

/** Привязать новый узел к группе по точке (absolute flow coords). */
export function placeWithOptionalParent(
  node: TopologyFlowNode,
  flowPosition: { x: number; y: number },
  nodes: TopologyFlowNode[],
): TopologyFlowNode {
  if (node.type === 'group') {
    return { ...node, zIndex: GROUP_Z, position: flowPosition }
  }
  if (!isAttachableType(node.type)) {
    return { ...node, position: flowPosition, zIndex: CONTENT_Z }
  }

  const group = findGroupAtPoint(nodes, flowPosition)
  if (!group) {
    return { ...node, position: flowPosition, zIndex: CONTENT_Z }
  }

  const byId = new Map(nodes.map((n) => [n.id, n]))
  const groupAbs = absolutePosition(group, byId)
  return {
    ...node,
    parentId: group.id,
    extent: 'parent',
    position: {
      x: flowPosition.x - groupAbs.x,
      y: flowPosition.y - groupAbs.y,
    },
    zIndex: CONTENT_Z,
  }
}

/** Родители перед детьми (стабильный порядок для RF). */
export function sortParentsFirst(nodes: TopologyFlowNode[]): TopologyFlowNode[] {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const depth = (n: TopologyFlowNode): number => {
    let d = 0
    let p = n.parentId
    const guard = new Set<string>()
    while (p && byId.has(p) && !guard.has(p)) {
      guard.add(p)
      d += 1
      p = byId.get(p)?.parentId
    }
    return d
  }
  return [...nodes].sort((a, b) => depth(a) - depth(b))
}
