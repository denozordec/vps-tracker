import { useQuery } from '@tanstack/react-query'
import type { AppSwitcherConfig } from '@cfdm/shared/contracts/app-switcher'
import { appSwitcherQueryOptions } from '@/queries/app-switcher'
import { getAppUrl as getAppUrlFromConfig } from '@/lib/app-switcher-config'

import { DEFAULT_APP_SWITCHER_CONFIG } from '@/lib/app-switcher-config'

export function useAppSwitcherConfig(): {
  config: AppSwitcherConfig
  isLoading: boolean
} {
  const { data, isLoading } = useQuery(appSwitcherQueryOptions())
  return {
    config: data ?? DEFAULT_APP_SWITCHER_CONFIG,
    isLoading,
  }
}

export function useAppUrl(appId: string): string | undefined {
  const { config } = useAppSwitcherConfig()
  return getAppUrlFromConfig(appId, config)
}
