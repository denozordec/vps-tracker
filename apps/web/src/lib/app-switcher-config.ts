import {
  ChartBarIcon,
  CloudIcon,
  GlobeIcon,
  LayoutDashboardIcon,
  ServerIcon,
  type LucideIcon,
} from 'lucide-react'
import type { AppSwitcherConfig, AppSwitcherEntry } from '@cfdm/shared/contracts/app-switcher'

/** JWT / portal app id for this product */
export const CURRENT_APP_ID = 'vps'

export type AppSwitcherIconName = keyof typeof APP_SWITCHER_ICONS

export const APP_SWITCHER_ICONS: Record<
  'server' | 'cloud' | 'globe' | 'dashboard' | 'chart',
  LucideIcon
> = {
  server: ServerIcon,
  cloud: CloudIcon,
  globe: GlobeIcon,
  dashboard: LayoutDashboardIcon,
  chart: ChartBarIcon,
}

/** Offline fallback when auth-portal is unreachable */
export const DEFAULT_APP_SWITCHER_CONFIG: AppSwitcherConfig = {
  menuLabel: 'Приложения',
  apps: [
    {
      id: 'vps',
      name: 'VPS Tracker',
      subtitle: 'Учёт виртуальных серверов',
      url: 'https://vps.shnt.top',
      icon: 'server',
    },
    {
      id: 'cfdm',
      name: 'CF Domain Manager',
      subtitle: 'Управление доменами',
      url: 'https://cfdm.shnt.top',
      icon: 'cloud',
    },
    {
      id: 'bgp',
      name: 'EvoBGP',
      subtitle: 'BGP маршрутизация',
      url: 'https://bgp.shnt.top',
      icon: 'globe',
    },
  ],
}

export function getAppUrl(
  appId: string,
  config: AppSwitcherConfig = DEFAULT_APP_SWITCHER_CONFIG,
): string | undefined {
  return config.apps.find((app) => app.id === appId)?.url
}

export function getCurrentApp(
  config: AppSwitcherConfig = DEFAULT_APP_SWITCHER_CONFIG,
): AppSwitcherEntry {
  return config.apps.find((app) => app.id === CURRENT_APP_ID) ?? config.apps[0]!
}
