import {
  ChartBarIcon,
  CloudIcon,
  GlobeIcon,
  LayoutDashboardIcon,
  ServerIcon,
  type LucideIcon,
} from 'lucide-react'
import { z } from 'zod'

export const CURRENT_APP_ID = 'vps-tracker'

const appSwitcherIconSchema = z.enum(['server', 'cloud', 'globe', 'dashboard', 'chart'])

export type AppSwitcherIconName = z.infer<typeof appSwitcherIconSchema>

export const APP_SWITCHER_ICONS: Record<AppSwitcherIconName, LucideIcon> = {
  server: ServerIcon,
  cloud: CloudIcon,
  globe: GlobeIcon,
  dashboard: LayoutDashboardIcon,
  chart: ChartBarIcon,
}

const appSwitcherEntrySchema = z.object({
  id: z.string(),
  name: z.string(),
  subtitle: z.string().optional(),
  url: z.string(),
  icon: appSwitcherIconSchema.default('server'),
  shortcut: z.string().optional(),
})

const appSwitcherConfigSchema = z.object({
  menuLabel: z.string().default('Приложения'),
  apps: z.array(appSwitcherEntrySchema).min(1),
})

export type AppSwitcherEntry = z.infer<typeof appSwitcherEntrySchema>
export type AppSwitcherConfig = z.infer<typeof appSwitcherConfigSchema>

export const DEFAULT_APP_SWITCHER_CONFIG: AppSwitcherConfig = {
  menuLabel: 'Приложения',
  apps: [
    {
      id: 'vps-tracker',
      name: 'VPS Tracker',
      subtitle: 'Учёт виртуальных серверов',
      url: 'http://192.168.100.67:3001',
      icon: 'server',
      shortcut: '⌘1',
    },
    {
      id: 'cfdm',
      name: 'CF Domain Manager',
      subtitle: 'Управление доменами',
      url: 'http://192.168.100.67:6363',
      icon: 'cloud',
      shortcut: '⌘2',
    },
  ],
}

export function parseAppSwitcherConfig(raw?: string): AppSwitcherConfig {
  if (!raw?.trim()) {
    return DEFAULT_APP_SWITCHER_CONFIG
  }

  try {
    const parsed = JSON.parse(raw) as unknown
    return appSwitcherConfigSchema.parse(parsed)
  } catch (error) {
    console.warn('Invalid VITE_APP_SWITCHER, using defaults:', error)
    return DEFAULT_APP_SWITCHER_CONFIG
  }
}

export function getAppSwitcherConfig(): AppSwitcherConfig {
  return parseAppSwitcherConfig(import.meta.env.VITE_APP_SWITCHER)
}

export function getAppUrl(
  appId: string,
  config: AppSwitcherConfig = getAppSwitcherConfig(),
): string | undefined {
  return config.apps.find((app) => app.id === appId)?.url
}

export function getCurrentApp(
  config: AppSwitcherConfig = getAppSwitcherConfig(),
): AppSwitcherEntry {
  return config.apps.find((app) => app.id === CURRENT_APP_ID) ?? config.apps[0]!
}
