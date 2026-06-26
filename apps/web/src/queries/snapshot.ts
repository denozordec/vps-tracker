import { queryClient } from '../lib/queryClient'
import { api } from '../lib/api-client'

export const snapshotKeys = {
  all: ['snapshot'] as const,
}

export const snapshotQueryOptions = () => ({
  queryKey: snapshotKeys.all,
  queryFn: () => api.fetchData(),
  staleTime: 30_000,
})

export const ratesKeys = {
  all: ['rates'] as const,
}

export const ratesQueryOptions = (ratesUrl?: string) => ({
  queryKey: ratesKeys.all,
  queryFn: async () => {
    if (!ratesUrl) return null
    const proxyUrl = `/api/rates-proxy?url=${encodeURIComponent(ratesUrl)}`
    try {
      const res = await fetch(proxyUrl)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return await res.json()
    } catch {
      const direct = await fetch(ratesUrl)
      if (!direct.ok) throw new Error(`HTTP ${direct.status}`)
      return await direct.json()
    }
  },
  enabled: Boolean(ratesUrl),
})

export const projectsKeys = {
  suggest: (q: string) => ['projects', 'suggest', q] as const,
}

export const projectsSuggestQueryOptions = (q: string) => ({
  queryKey: projectsKeys.suggest(q),
  queryFn: () => api.fetchProjectSuggestions(q),
  enabled: q.length >= 2,
})

export type SnapshotFromQuery = Awaited<ReturnType<typeof api.fetchData>>
export { queryClient }
