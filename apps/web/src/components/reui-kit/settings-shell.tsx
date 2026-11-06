import type { ReactNode } from 'react'
import { Link, Outlet, useRouterState } from '@tanstack/react-router'
import {
  BellIcon,
  PlugIcon,
  RefreshCwIcon,
  SettingsIcon,
} from 'lucide-react'

import { PageShell } from '@/components/page-shell'
import { PageHeader } from '@/components/page-header'
import { Tabs, TabsList, TabsTrigger } from '@cfdm/ui/components/tabs'

export interface SettingsTabConfig {
  id: string
  to: string
  label: string
  icon?: ReactNode
  exact?: boolean
}

const DEFAULT_TABS: SettingsTabConfig[] = [
  {
    id: 'general',
    to: '/settings',
    label: 'Общие',
    exact: true,
    icon: <SettingsIcon className="size-4" aria-hidden="true" />,
  },
  {
    id: 'sync',
    to: '/settings/sync',
    label: 'Синхронизация',
    icon: <RefreshCwIcon className="size-4" aria-hidden="true" />,
  },
  {
    id: 'notifications',
    to: '/settings/notifications',
    label: 'Уведомления',
    icon: <BellIcon className="size-4" aria-hidden="true" />,
  },
  {
    id: 'integrations',
    to: '/settings/integrations',
    label: 'Интеграции',
    icon: <PlugIcon className="size-4" aria-hidden="true" />,
  },
]

interface SettingsShellProps {
  title?: string
  description?: string
  tabs?: SettingsTabConfig[]
}

/** Settings shell — line tabs on top (design «VPS-Tracker»); sections: https://reui.io/preview/base/settings-16 */
export function SettingsShell({
  title = 'Настройки',
  description = 'Параметры приложения и связи с другими сервисами',
  tabs = DEFAULT_TABS,
}: SettingsShellProps) {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const active =
    tabs.find((tab) =>
      tab.exact ? pathname === tab.to || pathname === `${tab.to}/` : pathname.startsWith(tab.to),
    ) ?? tabs[0]

  return (
    <PageShell>
      <PageHeader title={title} description={description} />
      {/* Design «VPS-Tracker»: settings sections as page line tabs. */}
      {tabs.length > 1 ? (
        <Tabs value={active?.id}>
          <TabsList variant="line" aria-label="Разделы настроек" className="gap-5">
            {tabs.map((tab) => (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                nativeButton={false}
                render={<Link to={tab.to} />}
                className="text-muted-foreground hover:text-foreground h-auto gap-2 px-0 pb-3 after:bottom-0"
              >
                {tab.icon}
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      ) : null}
      <div className="min-w-0">
        <Outlet />
      </div>
    </PageShell>
  )
}
