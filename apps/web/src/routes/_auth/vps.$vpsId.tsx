import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import {
  ArrowLeftIcon,
  GlobeIcon,
  CpuIcon,
  CreditCardIcon,
  RefreshCwIcon,
  StickyNoteIcon,
} from 'lucide-react'

import { snapshotQueryOptions } from '@/queries/snapshot'
import { PageShell } from '@/components/page-shell'
import { PageHeader } from '@/components/page-header'
import { QueryState } from '@/components/query-state'
import { Button } from '@cfdm/ui/components/button'
import { Badge } from '@cfdm/ui/components/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@cfdm/ui/components/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@cfdm/ui/components/tabs'
import { DataGridCard, columnDefFromDataTable } from '@/components/data-grid-card'
import type { DataTableColumn } from '@/components/data-grid-types'
import { getPaidUntilDate } from '@/lib/paid-until'
import {
  effectiveVpsTariffCurrency,
  formatCurrency,
  formatInProviderCurrency,
  tariffTypeLabel,
  vpsStatusLabel,
  paymentTypeLabel,
} from '@/lib/format'
import { providerByIdMap, accountSelectLabel } from '@/lib/billmanager'
import { VPS_SYNC_OVERRIDE_FIELDS, parseUserOverrides } from '@/lib/vps-sync-fields'
import {
  parseCustomFieldDefs,
  parseCustomData,
  formatCustomFieldValue,
} from '@/lib/custom-fields'
import type { Payment, Vps } from '@/types/entities'

export const Route = createFileRoute('/_auth/vps/$vpsId')({
  loader: ({ context: { queryClient } }) =>
    queryClient.ensureQueryData(snapshotQueryOptions()),
  component: VpsDetailPage,
})

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-4">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  )
}

function VpsDetailPage() {
  const { vpsId } = Route.useParams()
  const { data: snapshot, isLoading, isError, error, refetch } = useQuery(snapshotQueryOptions())

  const vps = snapshot?.vps.find((v) => v.id === vpsId)
  const providerById = snapshot ? providerByIdMap(snapshot.providers) : new Map()
  const account = snapshot?.providerAccounts.find((a) => a.id === vps?.providerAccountId)
  const provider = vps ? providerById.get(vps.providerId) : undefined

  const paidUntil = useMemo(() => {
    if (!vps || !snapshot) return null
    return getPaidUntilDate(vps, {
      vps: snapshot.vps,
      providerAccounts: snapshot.providerAccounts,
      payments: snapshot.payments,
      balanceLedger: snapshot.balanceLedger,
      now: new Date(),
    })
  }, [vps, snapshot])

  const relatedPayments = useMemo(
    () => (snapshot?.payments ?? []).filter((p) => p.vpsId === vpsId),
    [snapshot, vpsId],
  )

  const overrides = vps ? parseUserOverrides((vps as Vps & { userOverrides?: unknown }).userOverrides) : []

  const customFieldDefs = useMemo(
    () => parseCustomFieldDefs((snapshot?.settings[0] as { customFields?: unknown })?.customFields),
    [snapshot],
  )

  const customFieldRows = useMemo(() => {
    if (!vps || customFieldDefs.length === 0) return []
    const data = parseCustomData((vps as Vps & { customData?: unknown }).customData)
    return customFieldDefs
      .map((def) => ({ def, value: data[def.key] }))
      .filter(({ value }) => value !== undefined && value !== null && value !== '')
  }, [vps, customFieldDefs])

  const paymentColumns: DataTableColumn<Payment>[] = [
    { key: 'date', header: 'Дата', cell: (p) => <span className="tabular-nums">{p.date}</span> },
    { key: 'type', header: 'Тип', cell: (p) => paymentTypeLabel(p.type) },
    {
      key: 'amount',
      header: 'Сумма',
      className: 'text-right',
      cell: (p) => <span className="tabular-nums">{formatCurrency(p.amount, p.currency)}</span>,
    },
    { key: 'note', header: 'Заметка', cell: (p) => p.note || '—' },
  ]

  return (
    <PageShell>
      <PageHeader
        title={vps ? (vps.ip || vps.dns || 'VPS') : 'VPS'}
        description={account ? accountSelectLabel(account, providerById) : undefined}
        actions={
          <Button variant="outline" render={<Link to="/vps" search={{ edit: vpsId }} />}>
            Редактировать
          </Button>
        }
      />

      <Button variant="ghost" size="sm" className="w-fit" render={<Link to="/vps" />}>
        <ArrowLeftIcon data-icon="inline-start" />
        К списку VPS
      </Button>

      <QueryState
        data={vps}
        isLoading={isLoading}
        isError={isError}
        error={error}
        onRetry={() => refetch()}
        empty={!isLoading && !vps}
        emptyTitle="VPS не найден"
        emptyDescription="Запись могла быть удалена"
        emptyAction={
          <Button render={<Link to="/vps" />}>К списку</Button>
        }
      >
        {(row) => (
          <Tabs defaultValue="overview">
            <TabsList>
              <TabsTrigger value="overview">Обзор</TabsTrigger>
              <TabsTrigger value="finance">Финансы</TabsTrigger>
              <TabsTrigger value="notes">Заметки</TabsTrigger>
              <TabsTrigger value="sync">Синк</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="flex flex-col gap-4">
              <div className="flex flex-wrap gap-2">
                <Badge variant={row.status === 'active' ? 'default' : 'secondary'}>
                  {vpsStatusLabel(row.status)}
                </Badge>
                {row.project ? <Badge variant="outline">{row.project}</Badge> : null}
                {row.environment ? <Badge variant="outline">{row.environment}</Badge> : null}
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <GlobeIcon className="size-4" />
                      Сеть
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-3">
                    <InfoRow label="IP" value={row.ip || '—'} />
                    <InfoRow label="DNS" value={row.dns || '—'} />
                    <InfoRow label="IPv6" value={(row as Vps & { ipv6?: string }).ipv6 || '—'} />
                    <InfoRow label="SSH порт" value={(row as Vps & { sshPort?: number }).sshPort ?? 22} />
                    <InfoRow label="Локация" value={[row.country, row.city].filter(Boolean).join(', ') || '—'} />
                    <InfoRow label="Дата-центр" value={row.datacenter || '—'} />
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <CpuIcon className="size-4" />
                      Ресурсы
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-3">
                    <InfoRow label="vCPU" value={row.vcpu} />
                    <InfoRow label="RAM" value={`${row.ramGb} GB`} />
                    <InfoRow label="Disk" value={`${row.diskGb} GB`} />
                    <InfoRow label="ОС" value={(row as Vps & { os?: string }).os || '—'} />
                    <InfoRow label="Хостер" value={provider?.name || '—'} />
                  </CardContent>
                </Card>
              </div>
              {customFieldRows.length > 0 ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Дополнительные поля</CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-3">
                    {customFieldRows.map(({ def, value }) => (
                      <InfoRow
                        key={def.key}
                        label={def.label}
                        value={formatCustomFieldValue(def, value)}
                      />
                    ))}
                  </CardContent>
                </Card>
              ) : null}
            </TabsContent>

            <TabsContent value="finance" className="flex flex-col gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <CreditCardIcon className="size-4" />
                    Тариф
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <InfoRow label="Тип" value={tariffTypeLabel(row.tariffType)} />
                  <InfoRow
                    label="Ставка"
                    value={formatInProviderCurrency(
                      row.tariffType === 'daily' ? Number(row.dailyRate || 0) * 30 : Number(row.monthlyRate || 0),
                      effectiveVpsTariffCurrency(row, provider),
                      provider,
                      snapshot?.settings ?? [],
                      null,
                    )}
                  />
                  <InfoRow
                    label="Оплачено до"
                    value={paidUntil ? paidUntil.toLocaleDateString('ru-RU') : '—'}
                  />
                </CardContent>
              </Card>
              <DataGridCard
                title="Связанные платежи"
                columns={columnDefFromDataTable(paymentColumns)}
                data={relatedPayments}
                rowId={(p) => p.id}
                emptyTitle="Платежей нет"
                pagination={false}
              />
            </TabsContent>

            <TabsContent value="notes">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <StickyNoteIcon className="size-4" />
                    Заметки
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="whitespace-pre-wrap text-sm">{row.notes?.trim() || 'Нет заметок'}</p>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="sync">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <RefreshCwIcon className="size-4" />
                    Защита от перезаписи при синке
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {overrides.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Все поля обновляются из BILLmanager</p>
                  ) : (
                    <ul className="flex flex-col gap-1 text-sm">
                      {overrides.map((key) => {
                        const label = VPS_SYNC_OVERRIDE_FIELDS.find((f) => f.key === key)?.label ?? key
                        return <li key={key}>• {label}</li>
                      })}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </QueryState>
    </PageShell>
  )
}
