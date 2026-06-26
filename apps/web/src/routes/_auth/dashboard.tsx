import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { ServerIcon, AlertTriangleIcon, WalletIcon, TrendingUpIcon } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'

import { snapshotQueryOptions, ratesQueryOptions } from '@/queries/snapshot'
import { PageShell } from '@/components/page-shell'
import { PageHeader } from '@/components/page-header'
import { SectionCards } from '@/components/section-cards'
import { QueryState } from '@/components/query-state'
import { DataGridCard } from '@/components/data-grid-card'
import { SectionCardsSkeleton } from '@/components/skeletons'
import { Button } from '@cfdm/ui/components/button'
import { Badge } from '@cfdm/ui/components/badge'

import { computeInventoryHealth } from '@/lib/inventory-health'
import { formatInBaseCurrency, normalizeRatesPayload } from '@/lib/format'
import { vpsStatusLabel } from '@/lib/format'

export const Route = createFileRoute('/_auth/dashboard')({
  loader: ({ context: { queryClient } }) =>
    queryClient.ensureQueryData(snapshotQueryOptions()),
  component: DashboardPage,
})

function DashboardPage() {
  const navigate = useNavigate()
  const { data: snapshot, isLoading, isError, error, refetch } = useQuery(snapshotQueryOptions())
  const settings = snapshot?.settings?.[0]
  const { data: rawRates } = useQuery(ratesQueryOptions(settings?.ratesUrl))
  const ratesData = normalizeRatesPayload(rawRates) ?? rawRates ?? null

  return (
    <PageShell>
      <PageHeader title="Дашборд" description="Сводка по VPS, балансам и здоровью инвентаря" />

      <QueryState
        data={snapshot}
        isLoading={isLoading}
        isError={isError}
        error={error}
        onRetry={() => refetch()}
        skeleton={<SectionCardsSkeleton />}
      >
        {(snap) => {
          const activeVps = snap.vps.filter((v) => v.status === 'active')
          const monthlyTotal = activeVps.reduce((acc, v) => {
            const monthly = Number(v.monthlyRate || 0)
            const daily = Number(v.dailyRate || 0)
            const burn = v.tariffType === 'daily' ? daily * 30 : monthly
            return acc + (Number.isFinite(burn) ? burn : 0)
          }, 0)
          const issues = computeInventoryHealth(snap)
          const totalBalance = snap.providerAccounts.reduce(
            (acc, a) => acc + (Number(a.balance_api ?? 0) || 0),
            0,
          )

          return (
            <>
              <SectionCards
                items={[
                  {
                    label: 'Активные VPS',
                    value: activeVps.length,
                    icon: <ServerIcon className="size-4" />,
                    hint: `всего ${snap.vps.length}`,
                  },
                  {
                    label: 'Хостеры',
                    value: snap.providers.length,
                    icon: <WalletIcon className="size-4" />,
                    hint: `${snap.providerAccounts.length} аккаунтов`,
                  },
                  {
                    label: 'Расход/мес (оценка)',
                    value: formatInBaseCurrency(monthlyTotal, snap.vps[0]?.currency ?? 'USD', snap.settings, ratesData),
                    icon: <TrendingUpIcon className="size-4" />,
                  },
                  {
                    label: 'Баланс аккаунтов (API)',
                    value: formatInBaseCurrency(totalBalance, snap.settings[0]?.baseCurrency ?? 'RUB', snap.settings, ratesData),
                    icon: <WalletIcon className="size-4" />,
                  },
                ]}
              />

              <DataGridCard
                title="Здоровье инвентаря"
                description="Подсказки: нет проекта, нет ставки, просрочка, устаревший синк, расхождения баланса"
                actions={
                  issues.length > 0 ? (
                    <Badge variant="destructive">{issues.length}</Badge>
                  ) : (
                    <Badge variant="secondary">всё ок</Badge>
                  )
                }
                columns={[
                  {
                    id: 'title',
                    header: 'Проблема',
                    cell: ({ row }) => (
                      <div className="flex items-center gap-2">
                        <AlertTriangleIcon className="size-4 text-destructive" />
                        <div className="flex flex-col">
                          <span>{row.original.title}</span>
                          {row.original.hint ? (
                            <span className="text-xs text-muted-foreground">{row.original.hint}</span>
                          ) : null}
                        </div>
                      </div>
                    ),
                  },
                  {
                    id: 'count',
                    header: 'Кол-во',
                    cell: ({ row }) => <span className="text-right tabular-nums">{row.original.count}</span>,
                    meta: { align: 'right' },
                  },
                  {
                    id: 'action',
                    header: 'Действие',
                    cell: ({ row }) => (
                      <Button variant="outline" size="sm" onClick={() => navigate({ to: row.original.to })}>
                        Открыть
                      </Button>
                    ),
                  },
                ] as ColumnDef<{ key: string; title: string; count: number; to: string; hint?: string }>[]}
                data={issues}
                rowId={(i) => i.key}
                emptyTitle="Проблем не найдено"
                emptyDescription="Все активные VPS имеют проект, ставку и актуальный синк"
              />

              <DataGridCard
                title="Последние VPS"
                description="Активные серверы"
                columns={[
                  {
                    id: 'ip',
                    header: 'IP / DNS',
                    cell: ({ row }) => <span className="font-medium">{row.original.ip || row.original.dns}</span>,
                  },
                  {
                    id: 'project',
                    header: 'Проект',
                    cell: ({ row }) => <span className="text-muted-foreground">{row.original.project || '—'}</span>,
                  },
                  {
                    id: 'status',
                    header: 'Статус',
                    cell: ({ row }) => (
                      <Badge variant={row.original.status === 'active' ? 'default' : 'secondary'}>
                        {vpsStatusLabel(row.original.status)}
                      </Badge>
                    ),
                  },
                  {
                    id: 'rate',
                    header: 'Ставка/мес',
                    cell: ({ row }) => (
                      <span className="text-right tabular-nums">
                        {formatInBaseCurrency(
                          row.original.tariffType === 'daily'
                            ? Number(row.original.dailyRate || 0) * 30
                            : Number(row.original.monthlyRate || 0),
                          row.original.currency,
                          snap.settings,
                          ratesData,
                        )}
                      </span>
                    ),
                  },
                ] as ColumnDef<typeof activeVps[number]>[]}
                data={activeVps.slice(0, 8)}
                rowId={(v) => v.id}
                pagination={false}
              />
            </>
          )
        }}
      </QueryState>
    </PageShell>
  )
}
