import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { ServerIcon, AlertTriangleIcon, WalletIcon, TrendingUpIcon } from 'lucide-react'

import { snapshotQueryOptions, ratesQueryOptions } from '@/queries/snapshot'
import { PageShell } from '@/components/page-shell'
import { PageHeader } from '@/components/page-header'
import { SectionCards } from '@/components/section-cards'
import { QueryState } from '@/components/query-state'
import { TableCard } from '@/components/table-card'
import { SectionCardsSkeleton } from '@/components/skeletons'
import { EmptyState } from '@/components/empty-state'
import { Button } from '@cfdm/ui/components/button'
import { Badge } from '@cfdm/ui/components/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@cfdm/ui/components/table'

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

              <TableCard
                title="Здоровье инвентаря"
                description="Подсказки: нет проекта, нет ставки, просрочка, устаревший синк, расхождения баланса"
                actions={
                  issues.length > 0 ? (
                    <Badge variant="destructive">{issues.length}</Badge>
                  ) : (
                    <Badge variant="secondary">всё ок</Badge>
                  )
                }
              >
                {issues.length === 0 ? (
                  <div className="p-4">
                    <EmptyState
                      icon={<TrendingUpIcon className="size-8" />}
                      title="Проблем не найдено"
                      description="Все активные VPS имеют проект, ставку и актуальный синк"
                    />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Проблема</TableHead>
                        <TableHead className="w-24 text-right">Кол-во</TableHead>
                        <TableHead className="w-32">Действие</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {issues.map((issue) => (
                        <TableRow key={issue.key}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <AlertTriangleIcon className="size-4 text-destructive" />
                              <div className="flex flex-col">
                                <span>{issue.title}</span>
                                {issue.hint ? (
                                  <span className="text-xs text-muted-foreground">{issue.hint}</span>
                                ) : null}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{issue.count}</TableCell>
                          <TableCell>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => navigate({ to: issue.to })}
                            >
                              Открыть
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </TableCard>

              <TableCard title="Последние VPS" description="Активные серверы">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>IP / DNS</TableHead>
                      <TableHead>Проект</TableHead>
                      <TableHead>Статус</TableHead>
                      <TableHead className="text-right">Ставка/мес</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activeVps.slice(0, 8).map((v) => (
                      <TableRow key={v.id}>
                        <TableCell className="font-medium">{v.ip || v.dns}</TableCell>
                        <TableCell className="text-muted-foreground">{v.project || '—'}</TableCell>
                        <TableCell>
                          <Badge variant={v.status === 'active' ? 'default' : 'secondary'}>
                            {vpsStatusLabel(v.status)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatInBaseCurrency(
                            v.tariffType === 'daily' ? Number(v.dailyRate || 0) * 30 : Number(v.monthlyRate || 0),
                            v.currency,
                            snap.settings,
                            ratesData,
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableCard>
            </>
          )
        }}
      </QueryState>
    </PageShell>
  )
}
