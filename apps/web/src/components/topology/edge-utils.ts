import { MarkerType, type Edge } from '@xyflow/react'
import { defaultEdgeData, type TopologyEdgeData } from './types'

export function applyEdgeVisuals(
  edge: Edge<TopologyEdgeData>,
  data: TopologyEdgeData,
): Edge<TopologyEdgeData> {
  const direction = data.direction ?? 'forward'
  const lineStyle = data.lineStyle ?? 'solid'

  return {
    ...edge,
    type: 'topology',
    label: undefined,
    data,
    style: {
      ...edge.style,
      strokeDasharray: lineStyle === 'dashed' ? '6 4' : undefined,
    },
    markerEnd:
      direction === 'none'
        ? undefined
        : { type: MarkerType.ArrowClosed, width: 16, height: 16 },
    markerStart:
      direction === 'bidirectional'
        ? { type: MarkerType.ArrowClosed, width: 16, height: 16 }
        : undefined,
  }
}

export function createConnectedEdge(connection: {
  source: string
  target: string
  sourceHandle?: string | null
  targetHandle?: string | null
}): Edge<TopologyEdgeData> {
  const data = defaultEdgeData()
  return applyEdgeVisuals(
    {
      id: `e-${connection.source}-${connection.target}-${Date.now().toString(36)}`,
      source: connection.source,
      target: connection.target,
      sourceHandle: connection.sourceHandle ?? undefined,
      targetHandle: connection.targetHandle ?? undefined,
      data,
    },
    data,
  )
}
