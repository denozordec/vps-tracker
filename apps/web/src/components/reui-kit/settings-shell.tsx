import type { ReactNode } from 'react'
import { Link, Outlet, useRouterState } from '@tanstack/react-router'
import { PlugIcon, SettingsIcon } from 'lucide-react'

import { useIsMobile } from '@cfdm/ui/hooks/use-mobile'
import { cn } from '@cfdm/ui/lib/utils'
import { PageShell } from '@/components/page-shell'
import { PageHeader } from '@/components/page-header'
import { Separator } from '@cfdm/ui/components/separator'

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

/** Settings shell — preview https://reui.io/preview/base/settings-16 */
export function SettingsShell({
  title = 'Настройки',
  description = 'Параметры приложения и связи с другими сервисами',
  tabs = DEFAULT_TABS,
}: SettingsShellProps) {
  const isMobile = useIsMobile()
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  return (
    <PageShell>
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
        <div className="flex flex-col gap-3">
          <PageHeader title={title} description={description} />
          <Separator />
        </div>

        <div
          className={cn(
            'flex gap-5',
            isMobile ? 'flex-col' : 'flex-row items-start',
          )}
        >
          {tabs.length > 1 ? (
            <nav
              aria-label="Разделы настроек"
              className={cn(
                'flex gap-1',
                isMobile
                  ? 'scrollbar-none -mx-1 overflow-x-auto overflow-y-hidden pb-1'
                  : 'w-44 shrink-0 flex-col',
              )}
            >
              {tabs.map((tab) => {
                const isActive = tab.exact
                  ? pathname === tab.to || pathname === `${tab.to}/`
                  : pathname.startsWith(tab.to)
                return (
                  <Link
                    key={tab.id}
                    to={tab.to}
                    aria-current={isActive ? 'page' : undefined}
                    className={cn(
                      'flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors',
                      isMobile && 'shrink-0',
                      !isMobile && 'w-full',
                      isActive
                        ? 'bg-muted text-foreground font-medium shadow-sm ring-1 ring-border/60'
                        : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                    )}
                  >
                    {tab.icon}
                    {tab.label}
                  </Link>
                )
              })}
            </nav>
          ) : null}

          <div className="min-w-0 flex-1">
            <Outlet />
          </div>
        </div>
      </div>
    </PageShell>
  )
}
