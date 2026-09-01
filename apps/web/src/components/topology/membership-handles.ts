import type { Edge } from '@xyflow/react'
import { getNodeCenterAbsolute } from './group-utils'
import type { TopologyEdgeData, TopologyFlowNode } from './types'

export type MembershipHandleSide = 'top' | 'right' | 'bottom' | 'left'

export function pickMembershipHandles(
  serviceCenter: { x: number; y: number },
  vpsCenter: { x: number; y: number },
): { sourceHandle: MembershipHandleSide; targetHandle: MembershipHandleSide } {
  const dx = vpsCenter.x - serviceCenter.x
  const dy = vpsCenter.y - serviceCenter.y
  if (Math.abs(dy) >= Math.abs(dx)) {
    if (dy >= 0) return { sourceHandle: 'bottom', targetHandle: 'top' }
    return { sourceHandle: 'top', targetHandle: 'bottom' }
  }
  if (dx >= 0) return { sourceHandle: 'right', targetHandle: 'left' }
  return { sourceHandle: 'left', targetHandle: 'right' }
}

export function clusterIdsForService(
  serviceNodeId: string,
  edges: readonly { source: string; target: string; data?: { relation?: string } }[],
): string[] {
  const ids = new Set<string>([serviceNodeId])
  for (const edge of edges) {
    if (edge.data?.relation !== 'membership') continue
    if (edge.source === serviceNodeId) ids.add(edge.target)
  }
  return [...ids]
}

export function applyMembershipHandles(
  edges: Edge<TopologyEdgeData>[],
  nodes: TopologyFlowNode[],
): Edge<TopologyEdgeData>[] {
  let changed = false
  const next = edges.map((edge) => {
    if (edge.data?.relation !== 'membership') return edge
    const source = nodes.find((n) => n.id === edge.source)
    const target = nodes.find((n) => n.id === edge.target)
    if (!source || !target) return edge
    const handles = pickMembershipHandles(
      getNodeCenterAbsolute(source, nodes),
      getNodeCenterAbsolute(target, nodes),
    )
    if (
      edge.sourceHandle === handles.sourceHandle &&
      edge.targetHandle === handles.targetHandle
    ) {
      return edge
    }
    changed = true
    return {
      ...edge,
      sourceHandle: handles.sourceHandle,
      targetHandle: handles.targetHandle,
    }
  })
  return changed ? next : edges
}
