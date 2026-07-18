import { queryOptions } from '@tanstack/react-query'
import type { AppSwitcherConfig } from '@cfdm/shared/contracts/app-switcher'
import { ensureAuthConfig } from '@/lib/auth'
import { DEFAULT_APP_SWITCHER_CONFIG } from '@/lib/app-switcher-config'

export const appSwitcherQueryKey = ['app-switcher', 'portal'] as const

async function fetchPortalAppSwitcher(): Promise<AppSwitcherConfig> {
  const { portalUrl } = await ensureAuthConfig()
  const base = portalUrl.replace(/\/$/, '')
  const res = await fetch(`${base}/api/v1/app-switcher`, {
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) {
    throw new Error(`app-switcher ${res.status}`)
  }
  return (await res.json()) as AppSwitcherConfig
}

export function appSwitcherQueryOptions() {
  return queryOptions({
    queryKey: appSwitcherQueryKey,
    queryFn: fetchPortalAppSwitcher,
    staleTime: 60_000,
    placeholderData: DEFAULT_APP_SWITCHER_CONFIG,
    retry: 1,
  })
}
