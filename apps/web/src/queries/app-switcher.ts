import { queryOptions } from '@tanstack/react-query'
import type { AppSwitcherConfig } from '@cfdm/shared/contracts/app-switcher'
import { api } from '@/lib/api-client'
import { DEFAULT_APP_SWITCHER_CONFIG } from '@/lib/app-switcher-config'

export const appSwitcherQueryKey = ['app-switcher'] as const

export function appSwitcherQueryOptions() {
  return queryOptions({
    queryKey: appSwitcherQueryKey,
    queryFn: () => api.get<AppSwitcherConfig>('/settings/app-switcher'),
    staleTime: 60_000,
    placeholderData: DEFAULT_APP_SWITCHER_CONFIG,
  })
}
