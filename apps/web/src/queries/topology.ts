import { api } from '@/lib/api-client'
import { getStoredSpaceId } from '@/lib/space'
import type {
  TopologyCreateInput,
  TopologyDiagram,
  TopologyDiagramListItem,
  TopologyUpdateInput,
} from '@cfdm/shared/contracts/topology'

export const topologyKeys = {
  all: ['topology'] as const,
  list: (spaceId: string | null) => ['topology', 'list', spaceId ?? 'default'] as const,
  detail: (spaceId: string | null, id: string) =>
    ['topology', 'detail', spaceId ?? 'default', id] as const,
}

export function topologyListQueryOptions(spaceId?: string | null) {
  const id = spaceId === undefined ? getStoredSpaceId() : spaceId
  return {
    queryKey: topologyKeys.list(id),
    queryFn: (): Promise<TopologyDiagramListItem[]> => api.fetchTopologyList(),
    staleTime: 15_000,
  }
}

export function topologyDetailQueryOptions(diagramId: string, spaceId?: string | null) {
  const id = spaceId === undefined ? getStoredSpaceId() : spaceId
  return {
    queryKey: topologyKeys.detail(id, diagramId),
    queryFn: (): Promise<TopologyDiagram> => api.fetchTopology(diagramId),
    staleTime: 5_000,
    enabled: Boolean(diagramId),
  }
}

export type { TopologyCreateInput, TopologyDiagram, TopologyDiagramListItem, TopologyUpdateInput }
