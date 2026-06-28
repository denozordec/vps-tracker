import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { CalendarIcon } from 'lucide-react'

import { snapshotQueryOptions } from '@/queries/snapshot'
import { PageShell } from '@/components/page-shell'
import { PageHeader } from '@/components/page-header'
import { QueryState } from '@/components/query-state'
import { Card, CardContent, CardHeader, CardTitle } from '@cfdm/ui/components/card'
import { Badge } from '@cfdm/ui/components/badge'
import { Button } from '@cfdm/ui/components/button'
import { SelectField } from '@/components/select-field'
import { getPaidUntilDate } from '@/lib/paid-until'
import { providerByIdMap } from '@/lib/billmanager'

export const Route = createFileRoute('/_auth/renewals')({
  loader: ({ context: { queryClient } }) =>
    queryClient.ensureQueryData(snapshotQueryOptions()),
  component: RenewalsPage,
})

type Horizon = '7' | '30' | '90'

interface RenewalItem {
  id: string
  kind: 'vps'
  label: string
  sublabel: string
  date: Date
  overdue: boolean
}

function RenewalsPage() {
  const [horizon, setHorizon] = useState<Horizon>('30')
  const { data: snapshot, isLoading, isError, error, refetch } = useQuery(snapshotQueryOptions())

  const items = useMemo(() => {
    if (!snapshot) return []
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const maxDays = Number(horizon)
    const maxDate = new Date(todayStart)
    maxDate.setDate(maxDate.getDate() + maxDays)
    const ctx = {
      vps: snapshot.vps,
      providerAccounts: snapshot.providerAccounts,
      payments: snapshot.payments,
      balanceLedger: snapshot.balanceLedger,
      now,
    }
    const providerById = providerByIdMap(snapshot.providers)
    const list: RenewalItem[] = []
    for (const v of snapshot.vps) {
      if (v.status !== 'active') continue
      const d = getPaidUntilDate(v, ctx)
      if (!d) continue
      if (d > maxDate) continue
      const acc = snapshot.providerAccounts.find((a) => a.id === v.providerAccountId)
      const providerName = acc ? providerById.get(acc.providerId)?.name ?? '' : ''
      list.push({
        id: v.id,
        kind: 'vps',
        label: v.ip || v.dns || v.id,
        sublabel: [acc?.name, providerName].filter(Boolean).join(' · '),
        date: d,
        overdue: d < todayStart,
      })
    }
    return list.sort((a, b) => a.date.getTime() - b.date.getTime())
  }, [snapshot, horizon])

  const grouped = useMemo(() => {
    const map = new Map<string, RenewalItem[]>()
    for (const item of items) {
      const key = item.date.toLocaleDateString('ru-RU', { year: 'numeric', month: 'long', day: 'numeric' })
      const arr = map.get(key) ?? []
      arr.push(item)
      map.set(key, arr)
    }
    return [...map.entries()]
  }, [items])

  return (
    <PageShell>
      <PageHeader
        title="Продления"
        description="Календарь истечения оплаты VPS"
        actions={
          <SelectField
            value={horizon}
            onValueChange={(v) => setHorizon((v ?? '30') as Horizon)}
            options={[
              { value: '7', label: '7 дней' },
              { value: '30', label: '30 дней' },
              { value: '90', label: '90 дней' },
            ]}
            triggerClassName="w-36"
          />
        }
      />

      <QueryState
        data={snapshot}
        isLoading={isLoading}
        isError={isError}
        error={error}
        onRetry={() => refetch()}
        empty={items.length === 0}
        emptyTitle="Нет продлений в выбранном периоде"
        emptyDescription="Активные VPS с расчётной датой оплаты не найдены"
      >
        {() => (
          <div className="flex flex-col gap-4">
            {grouped.map(([weekLabel, weekItems]) => (
              <Card key={weekLabel}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <CalendarIcon className="size-4" />
                    {weekLabel}
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-2">
                  {weekItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2"
                    >
                      <div className="flex flex-col gap-0.5">
                        <Button
                          variant="link"
                          className="h-auto justify-start p-0 font-medium"
                          render={<Link to="/vps/$vpsId" params={{ vpsId: item.id }} />}
                        >
                          {item.label}
                        </Button>
                        <span className="text-xs text-muted-foreground">{item.sublabel}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {item.overdue ? <Badge variant="destructive">Просрочено</Badge> : null}
                        <span className="tabular-nums text-sm">{item.date.toLocaleDateString('ru-RU')}</span>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </QueryState>
    </PageShell>
  )
}
