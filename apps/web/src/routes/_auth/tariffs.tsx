import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState, useEffect } from 'react'
import { toast } from 'sonner'

import { snapshotQueryOptions } from '@/queries/snapshot'
import { api, ApiError } from '@/lib/api-client'
import { Alert, AlertDescription, AlertTitle } from '@cfdm/ui/components/alert'
import { Badge } from '@cfdm/ui/components/badge'
import { ResourcePage, columnDefFromDataGrid, loadStoredColumnVisibility, dataGridColumnVisibilityOptions } from '@/components/reui-kit'
import type { VisibilityState } from '@tanstack/react-table'
import type { DataGridColumn } from '@/components/data-grid-types'
import { dataGridCellStack } from '@/components/data-grid-cells'
import { CrudListPage } from '@/components/crud-list-page'
import { EmptyState } from '@/components/empty-state'
import { Button } from '@cfdm/ui/components/button'
import {
  ServerIcon,
  UserRoundIcon,
  CpuIcon,
  CoinsIcon,
  HardDriveIcon,
  RefreshCwIcon,
  MapPinIcon,
  GlobeIcon,
} from 'lucide-react'

import type { ActiveTariff } from '@/types/entities'
import { providerByIdMap, accountSelectLabel, billmanagerSyncableAccounts } from '@/lib/billmanager'
import { formatCurrency } from '@/lib/format'
import { computeTariffDiffs } from '@/lib/tariff-diff'
import {
  applyTariffFilters,
  buildDefaultTariffFilters,
  hasTariffZeroResults,
  type TariffFiltersState,
} from '@/components/tariff-filters'
import { TariffsFiltersToolbar } from '@/components/tariff-filters-toolbar'
import { CountryFlag } from '@/components/country-flag'
import { COUNTRY_BY_NAME_RU } from '@cfdm/shared/geo'

export const Route = createFileRoute('/_auth/tariffs')({
  loader: ({ context: { queryClient } }) =>
    queryClient.ensureQueryData(snapshotQueryOptions()),
  component: TariffsPage,
})

const INITIAL_COLUMN_VISIBILITY: VisibilityState = {
  location: false,
  country: false,
  datacenterName: false,
}

function tariffDisplayId(t: ActiveTariff): string {
  return t.externalId ?? t.pricelistId ?? t.id
}

function TariffsPage() {
  const queryClient = useQueryClient()
  const { data: snapshot, isLoading, isError, error, refetch } = useQuery(snapshotQueryOptions())
  const [filters, setFilters] = useState<TariffFiltersState>(buildDefaultTariffFilters())
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() => ({
    ...INITIAL_COLUMN_VISIBILITY,
    ...(loadStoredColumnVisibility('tariffs-column-visibility') ?? {}),
  }))

  useEffect(() => {
    localStorage.setItem('tariffs-column-visibility', JSON.stringify(columnVisibility))
  }, [columnVisibility])

  const providerById = snapshot ? providerByIdMap(snapshot.providers) : new Map()
  const syncableCount = snapshot
    ? billmanagerSyncableAccounts(snapshot.providerAccounts, snapshot.providers).length
    : 0

  const filterCtx = useMemo(
    () => ({ providerAccounts: snapshot?.providerAccounts ?? [] }),
    [snapshot?.providerAccounts],
  )

  const filteredTariffs = useMemo(
    () => applyTariffFilters(snapshot?.activeTariffs ?? [], filters, filterCtx),
    [snapshot?.activeTariffs, filters, filterCtx],
  )

  const countryOptions = useMemo(() => {
    const names = new Set<string>()
    for (const t of snapshot?.activeTariffs ?? []) {
      const c = (t.country ?? '').trim()
      if (c) names.add(c)
    }
    return [...names].sort((a, b) => a.localeCompare(b, 'ru')).map((name) => {
      const ref = COUNTRY_BY_NAME_RU[name.toLowerCase()]
      return {
        value: name,
        label: name,
        code: ref?.code,
      }
    })
  }, [snapshot?.activeTariffs])

  const locationOptions = useMemo(() => {
    const names = new Set<string>()
    for (const t of snapshot?.activeTariffs ?? []) {
      const loc = (t.location ?? '').trim()
      if (loc) names.add(loc)
    }
    return [...names].sort((a, b) => a.localeCompare(b, 'ru')).map((value) => ({
      value,
      label: value,
    }))
  }, [snapshot?.activeTariffs])

  const diskTypeOptions = useMemo(() => {
    const types = new Set<string>()
    for (const t of snapshot?.activeTariffs ?? []) {
      const d = (t.diskType ?? '').trim()
      if (d) types.add(d)
    }
    return [...types].sort((a, b) => a.localeCompare(b, 'ru'))
  }, [snapshot?.activeTariffs])

  const currencyOptions = useMemo(() => {
    const currencies = new Set<string>()
    for (const t of snapshot?.activeTariffs ?? []) {
      const c = (t.currency ?? '').trim()
      if (c) currencies.add(c)
    }
    return [...currencies].sort((a, b) => a.localeCompare(b, 'ru'))
  }, [snapshot?.activeTariffs])

  const tariffDiffs = useMemo(
    () => (snapshot ? computeTariffDiffs(snapshot.vps, snapshot.activeTariffs) : []),
    [snapshot],
  )

  const syncTariffsMut = useMutation({
    mutationFn: async () => {
      if (!snapshot) return { tariffsCount: 0 }
      const accounts = billmanagerSyncableAccounts(snapshot.providerAccounts, snapshot.providers)
      let tariffsCount = 0
      for (const a of accounts) {
        const res = (await api.syncAccount(a.id)) as {
          synced?: { tariffsCount?: number }
        }
        tariffsCount += res?.synced?.tariffsCount ?? 0
      }
      return { tariffsCount, accounts: accounts.length }
    },
    onSuccess: ({ tariffsCount, accounts }) => {
      void queryClient.invalidateQueries({ queryKey: ['snapshot'] })
      if (accounts === 0) {
        toast.error('Нет аккаунтов BILLmanager с настроенным API')
        return
      }
      toast.success(`Загружено тарифов: ${tariffsCount}`)
    },
    onError: (e: unknown) => toast.error(e instanceof ApiError ? e.message : 'Ошибка загрузки тарифов'),
  })

  const handleColumnVisibilityChange = (columnId: string, visible: boolean) => {
    setColumnVisibility((prev) => {
      const next = { ...prev }
      if (visible) {
        delete next[columnId]
      } else {
        next[columnId] = false
      }
      return next
    })
  }

  const columns: DataGridColumn<ActiveTariff>[] = useMemo(
    () => [
      {
        key: 'name',
        header: 'Тариф',
        icon: ServerIcon,
        cell: (t) => (
          <span className="font-medium">{t.name || `#${tariffDisplayId(t)}`}</span>
        ),
      },
      {
        key: 'account',
        header: 'Аккаунт',
        icon: UserRoundIcon,
        sortValue: (t) => {
          const acc = snapshot?.providerAccounts.find((a) => a.id === t.providerAccountId)
          return acc ? accountSelectLabel(acc, providerById) : ''
        },
        cell: (t) => {
          const acc = snapshot?.providerAccounts.find((a) => a.id === t.providerAccountId)
          if (!acc) return '—'
          const providerName = providerById.get(acc.providerId)?.name ?? '—'
          return dataGridCellStack(acc.name, providerName)
        },
      },
      {
        key: 'specs',
        header: 'Ресурсы',
        icon: CpuIcon,
        sortValue: (t) => t.vcpu ?? 0,
        cell: (t) => (
          <span className="tabular-nums text-muted-foreground">
            {t.vcpu ?? '—'} vCPU / {t.ramGb ?? '—'} GB / {t.diskGb ?? '—'} GB
          </span>
        ),
      },
      {
        key: 'price',
        header: 'Цена/мес',
        icon: CoinsIcon,
        headerClassName: 'text-right',
        className: 'text-right',
        sortValue: (t) => Number(t.monthlyRate ?? 0),
        cell: (t) => (
          <span className="tabular-nums font-medium">
            {formatCurrency(Number(t.monthlyRate ?? 0), t.currency ?? 'RUB')}
          </span>
        ),
      },
      {
        key: 'disk',
        header: 'Диск',
        icon: HardDriveIcon,
        sortValue: (t) => t.diskType ?? '',
        cell: (t) => <Badge variant="outline">{t.diskType ?? '—'}</Badge>,
      },
      {
        key: 'location',
        header: 'Локация',
        icon: MapPinIcon,
        sortValue: (t) => t.location ?? '',
        cell: (t) => (
          <span className="text-muted-foreground">{t.location ?? '—'}</span>
        ),
      },
      {
        key: 'country',
        header: 'Страна',
        icon: GlobeIcon,
        sortValue: (t) => t.country ?? '',
        cell: (t) => {
          const country = (t.country ?? '').trim()
          if (!country) return '—'
          const ref = COUNTRY_BY_NAME_RU[country.toLowerCase()]
          return (
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              <CountryFlag code={ref?.code} country={country} />
              {country}
            </span>
          )
        },
      },
      {
        key: 'datacenterName',
        header: 'Дата-центр',
        icon: MapPinIcon,
        sortValue: (t) => t.datacenterName ?? '',
        cell: (t) => (
          <span className="text-muted-foreground">{t.datacenterName ?? '—'}</span>
        ),
      },
    ],
    [snapshot, providerById],
  )

  const columnVisibilityOptions = useMemo(
    () => dataGridColumnVisibilityOptions(columns),
    [columns],
  )

  return (
    <CrudListPage
      title="Активные тарифы"
      description="Тарифы, загруженные из BILLmanager vds.order"
      actions={
        syncableCount > 0 ? (
          <Button variant="outline" disabled={syncTariffsMut.isPending} onClick={() => syncTariffsMut.mutate()}>
            <RefreshCwIcon data-icon="inline-start" />
            Загрузить тарифы
          </Button>
        ) : undefined
      }
      data={snapshot}
      isLoading={isLoading}
      isError={isError}
      error={error}
      onRetry={() => refetch()}
      empty={snapshot?.activeTariffs.length === 0}
      emptyTitle="Тарифы не загружены"
      emptyDescription="Синхронизация аккаунта BILLmanager загружает тарифы вместе с VPS и платежами"
      emptyAction={
        <div className="flex flex-wrap justify-center gap-2">
          {syncableCount > 0 ? (
            <Button disabled={syncTariffsMut.isPending} onClick={() => syncTariffsMut.mutate()}>
              <RefreshCwIcon data-icon="inline-start" />
              Загрузить тарифы
            </Button>
          ) : null}
          <Button variant="outline" render={<Link to="/accounts" />}>
            Перейти к аккаунтам
          </Button>
        </div>
      }
    >
      {(snap) => {
        const zeroResults = hasTariffZeroResults(filters, snap.activeTariffs.length, filteredTariffs.length)

        const toolbar = (
          <TariffsFiltersToolbar
            filters={filters}
            onChange={setFilters}
            providers={snap.providers}
            providerAccounts={snap.providerAccounts}
            tariffs={snap.activeTariffs}
            countryOptions={countryOptions}
            locationOptions={locationOptions}
            diskTypeOptions={diskTypeOptions}
            currencyOptions={currencyOptions}
            shownCount={filteredTariffs.length}
            totalCount={snap.activeTariffs.length}
            columnVisibilityOptions={columnVisibilityOptions}
            columnVisibility={columnVisibility}
            onColumnVisibilityChange={handleColumnVisibilityChange}
          />
        )

        if (zeroResults) {
          return (
            <div className="flex flex-col gap-4">
              {tariffDiffs.length > 0 ? (
                <Alert>
                  <AlertTitle>Расхождение тариф vs VPS ({tariffDiffs.length})</AlertTitle>
                  <AlertDescription className="flex flex-col gap-1">
                    {tariffDiffs.slice(0, 5).map((d) => (
                      <span key={d.vpsId}>
                        <Button
                          variant="link"
                          className="h-auto p-0"
                          render={<Link to="/vps/$vpsId" params={{ vpsId: d.vpsId }} />}
                        >
                          {d.vpsLabel}
                        </Button>
                        {' '}({d.tariffName}): {d.issues.join('; ')}
                      </span>
                    ))}
                    {tariffDiffs.length > 5 ? <span>…и ещё {tariffDiffs.length - 5}</span> : null}
                  </AlertDescription>
                </Alert>
              ) : null}
              {toolbar}
              <EmptyState
                title="Ничего не найдено"
                description="По текущим фильтрам тарифы не найдены"
                action={
                  <Button variant="outline" onClick={() => setFilters(buildDefaultTariffFilters())}>
                    Сбросить фильтры
                  </Button>
                }
              />
            </div>
          )
        }

        return (
          <div className="flex flex-col gap-4">
            {tariffDiffs.length > 0 ? (
              <Alert>
                <AlertTitle>Расхождение тариф vs VPS ({tariffDiffs.length})</AlertTitle>
                <AlertDescription className="flex flex-col gap-1">
                  {tariffDiffs.slice(0, 5).map((d) => (
                    <span key={d.vpsId}>
                      <Button
                        variant="link"
                        className="h-auto p-0"
                        render={<Link to="/vps/$vpsId" params={{ vpsId: d.vpsId }} />}
                      >
                        {d.vpsLabel}
                      </Button>
                      {' '}({d.tariffName}): {d.issues.join('; ')}
                    </span>
                  ))}
                  {tariffDiffs.length > 5 ? <span>…и ещё {tariffDiffs.length - 5}</span> : null}
                </AlertDescription>
              </Alert>
            ) : null}
            {toolbar}
            <ResourcePage
              columns={columnDefFromDataGrid(columns)}
              data={filteredTariffs}
              getRowId={(t) => t.id}
              emptyTitle="Тарифы не найдены"
              dense={filters.tableCompact}
              virtualization={filteredTariffs.length > 200}
              height={560}
              enableColumnVisibility
              columnVisibility={columnVisibility}
              onColumnVisibilityChange={setColumnVisibility}
              columnVisibilityTrigger={false}
            />
          </div>
        )
      }}
    </CrudListPage>
  )
}
