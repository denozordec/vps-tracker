import { queryClient } from '../lib/queryClient'
import { api } from '../lib/api-client'
import { getStoredSpaceId } from '../lib/space'

export const ipregionKeys = {
  all: ['ipregion'] as const,
  current: (spaceId: string | null) => ['ipregion', 'current', spaceId ?? 'default'] as const,
  history: (spaceId: string | null, params: Record<string, unknown>) =>
    ['ipregion', 'history', spaceId ?? 'default', params] as const,
  detail: (id: string) => ['ipregion', 'run', id] as const,
}

export const ipregionCurrentQueryOptions = (spaceId?: string | null) => {
  const id = spaceId === undefined ? getStoredSpaceId() : spaceId
  return {
    queryKey: ipregionKeys.current(id),
    queryFn: () => api.fetchIpregionCurrent(),
    staleTime: 15_000,
  }
}

export const ipregionHistoryQueryOptions = (
  params: { cursor?: string; limit?: number; q?: string; status?: string; matched?: boolean } = {},
  spaceId?: string | null,
) => {
  const id = spaceId === undefined ? getStoredSpaceId() : spaceId
  return {
    queryKey: ipregionKeys.history(id, params),
    queryFn: () => api.fetchIpregionRuns({ limit: 50, ...params }),
    staleTime: 15_000,
  }
}

export const ipregionRunQueryOptions = (id: string | null) => ({
  queryKey: ipregionKeys.detail(id ?? ''),
  queryFn: () => api.fetchIpregionRun(id!),
  enabled: Boolean(id),
})

export { queryClient }
