import { memo } from 'react'
import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  type Edge,
  type EdgeProps,
} from '@xyflow/react'
import { Badge } from '@/components/reui/badge'
import { cn } from '@cfdm/ui/lib/utils'
import {
  edgeRelationShortLabel,
  formatEdgeTunnelIps,
  type TopologyEdgeData,
} from '../types'

function TopologyEdgeComponent(props: EdgeProps<Edge<TopologyEdgeData>>) {
  const {
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    style,
    markerEnd,
    markerStart,
    selected,
    data,
  } = props

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  })

  const relation = data?.relation ?? 'network'
  const title = data?.label?.trim() ?? ''
  const protocol = data?.protocol?.trim() ?? ''
  const tunnelIps = formatEdgeTunnelIps(data ?? {})

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        markerStart={markerStart}
        style={{
          ...style,
          strokeWidth: selected ? 2.5 : 1.5,
        }}
      />
      <EdgeLabelRenderer>
        <div
          className={cn(
            'nodrag nopan absolute flex max-w-[220px] flex-wrap items-center justify-center gap-1 rounded-md border border-border bg-background/95 px-1.5 py-1 shadow-sm backdrop-blur-sm',
            selected && 'ring-1 ring-primary/40',
          )}
          style={{
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all',
          }}
        >
          <Badge variant="info-light" size="xs" radius="full">
            {edgeRelationShortLabel(relation)}
          </Badge>
          {title ? (
            <Badge variant="outline" size="xs" radius="full">
              {title}
            </Badge>
          ) : null}
          {protocol ? (
            <Badge variant="primary-light" size="xs" radius="full" className="font-mono">
              {protocol}
            </Badge>
          ) : null}
          {tunnelIps ? (
            <Badge variant="secondary" size="xs" radius="full" className="font-mono">
              {tunnelIps}
            </Badge>
          ) : null}
        </div>
      </EdgeLabelRenderer>
    </>
  )
}

export const TopologyEdge = memo(TopologyEdgeComponent)
