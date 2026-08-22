import { queryClient } from '../lib/queryClient'
import { api } from '../lib/api-client'
import { getStoredSpaceId } from '../lib/space'

export const censorcheckKeys = {
  all: ['censorcheck'] as const,
  current: (spaceId: string | null) => ['censorcheck', 'current', spaceId ?? 'default'] as const,
  history: (spaceId: string | null, params: Record<string, unknown>) =>
    ['censorcheck', 'history', spaceId ?? 'default', params] as const,
  detail: (id: string) => ['censorcheck', 'run', id] as const,
}

export const censorcheckCurrentQueryOptions = (spaceId?: string | null) => {
  const id = spaceId === undefined ? getStoredSpaceId() : spaceId
  return {
    queryKey: censorcheckKeys.current(id),
    queryFn: () => api.fetchCensorcheckCurrent(),
    staleTime: 15_000,
  }
}

export const censorcheckHistoryQueryOptions = (
  params: { cursor?: string; limit?: number; q?: string; status?: string; matched?: boolean } = {},
  spaceId?: string | null,
) => {
  const id = spaceId === undefined ? getStoredSpaceId() : spaceId
  return {
    queryKey: censorcheckKeys.history(id, params),
    queryFn: () => api.fetchCensorcheckRuns({ limit: 50, ...params }),
    staleTime: 15_000,
  }
}

export const censorcheckRunQueryOptions = (id: string | null) => ({
  queryKey: censorcheckKeys.detail(id ?? ''),
  queryFn: () => api.fetchCensorcheckRun(id!),
  enabled: Boolean(id),
})

export { queryClient }
