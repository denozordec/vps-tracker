import { createFileRoute, Link, Outlet, useRouterState } from '@tanstack/react-router'
import { cn } from '@cfdm/ui/lib/utils'

import { snapshotQueryOptions } from '@/queries/snapshot'
import { PageShell } from '@/components/page-shell'
import { PageHeader } from '@/components/page-header'

export const Route = createFileRoute('/_auth/settings')({
  loader: ({ context: { queryClient } }) =>
    queryClient.ensureQueryData(snapshotQueryOptions()),
  component: SettingsLayout,
})

const TABS = [
  { to: '/settings', label: 'Общие', exact: true },
  { to: '/settings/integrations', label: 'Интеграции', exact: false },
] as const

function SettingsLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  return (
    <PageShell>
      <PageHeader title="Настройки" description="Параметры приложения и связи с другими сервисами" />
      <nav className="flex gap-1 border-b pb-0">
        {TABS.map((tab) => {
          const active = tab.exact
            ? pathname === tab.to || pathname === `${tab.to}/`
            : pathname.startsWith(tab.to)
          return (
            <Link
              key={tab.to}
              to={tab.to}
              className={cn(
                'rounded-t-md px-4 py-2 text-sm font-medium transition-colors',
                active
                  ? 'border border-b-0 bg-background text-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {tab.label}
            </Link>
          )
        })}
      </nav>
      <Outlet />
    </PageShell>
  )
}
