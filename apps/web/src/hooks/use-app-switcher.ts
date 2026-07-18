import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { AppSwitcherConfig } from '@cfdm/shared/contracts/app-switcher'
import { appSwitcherQueryOptions } from '@/queries/app-switcher'
import {
  DEFAULT_APP_SWITCHER_CONFIG,
  getAppUrl as getAppUrlFromConfig,
} from '@/lib/app-switcher-config'
import { getClaims } from '@/lib/auth'

export function useAppSwitcherConfig(): {
  config: AppSwitcherConfig
  isLoading: boolean
} {
  const { data, isLoading } = useQuery(appSwitcherQueryOptions())
  const claims = getClaims()

  const config = useMemo(() => {
    const raw = data ?? DEFAULT_APP_SWITCHER_CONFIG
    const apps = raw.apps.filter((a) => (a as { enabled?: boolean }).enabled !== false)
    const allowed = claims?.apps
    if (!allowed?.length) {
      return { ...raw, apps }
    }
    const set = new Set(allowed)
    return {
      ...raw,
      apps: apps.filter((a) => set.has(a.id)),
    }
  }, [data, claims?.apps])

  return { config, isLoading }
}

export function useAppUrl(appId: string): string | undefined {
  const { config } = useAppSwitcherConfig()
  return getAppUrlFromConfig(appId, config)
}
