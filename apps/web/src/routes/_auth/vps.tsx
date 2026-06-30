import { createFileRoute, useNavigate, Link } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useMemo, useEffect } from 'react'
import { PlusIcon, GlobeIcon, UserRoundIcon, FolderKanbanIcon, CpuIcon, CircleDotIcon, CreditCardIcon, MapPinIcon, CalendarIcon, ActivityIcon } from 'lucide-react'
import { toast } from 'sonner'
import { snapshotQueryOptions, ratesQueryOptions } from '@/queries/snapshot'
import { api, ApiError } from '@/lib/api-client'
import type { VpsFormValues } from '@/lib/schemas'
import { normalizeRatesPayload, effectiveVpsTariffCurrency, formatInProviderCurrency, vpsStatusLabel, tariffTypeLabel, vpsTariffRateAmount, vpsTariffMonthlyBurn } from '@/lib/format'
import { PageShell } from '@/components/page-shell'
import { PageHeader } from '@/components/page-header'
import { Button } from '@cfdm/ui/components/button'
import { Badge } from '@cfdm/ui/components/badge'
import { DataGridCard, columnDefFromDataGrid, loadStoredColumnVisibility, dataGridColumnVisibilityOptions } from '@/components/data-grid-card'
import type { VisibilityState } from '@tanstack/react-table'
import type { DataGridColumn } from '@/components/data-grid-types'
import { dataGridCellStack, dataGridCellWithFlag } from '@/components/data-grid-cells'
import { CountryFlag } from '@/components/country-flag'
import { QueryState } from '@/components/query-state'
import { EmptyState } from '@/components/empty-state'
import { TableSkeleton } from '@/components/skeletons'
import { RowActions } from '@/components/row-actions'
import { VpsEditSheet, VPS_FORM_EMPTY, vpsFormFromRow } from '@/components/domain/vps-edit-sheet'
import {
  applyVpsFilters,
  buildDefaultVpsFilters,
  hasActiveVpsFilters,
  type VpsFiltersState,
} from '@/components/vps-filters'
import { VpsFiltersToolbar } from '@/components/vps-filters-toolbar'
import { HealthModeBanner } from '@/components/health-mode-banner'
import { ProjectColorDot } from '@/components/project-color-dot'
import { VpsBulkToolbar } from '@/components/domain/vps-bulk-toolbar'
import { VpsDomainsCell, UnmatchedDomainsBanner } from '@/components/integrations/vps-domains-cell'

import type { Vps } from '@/types/entities'
import { providerByIdMap, accountSelectLabel } from '@/lib/billmanager'
import { COUNTRIES, COUNTRY_BY_NAME_RU, buildCityOptions } from '@cfdm/shared/geo'
import { getPaidUntilDate } from '@/lib/paid-until'
import { parseCustomFieldDefs, buildCustomFieldColumns, buildCustomFieldColumnVisibility } from '@/lib/custom-fields'

import { z } from 'zod'

const vpsSearchSchema = z.object({
  health: z.string().optional(),
  edit: z.string().optional(),
  project: z.string().optional(),
})

export const Route = createFileRoute('/_auth/vps')({
  validateSearch: (search) => vpsSearchSchema.parse(search),
  loader: ({ context: { queryClient } }) =>
    queryClient.ensureQueryData(snapshotQueryOptions()),
  component: VpsPage,
})

const EMPTY_FORM = VPS_FORM_EMPTY

function VpsPage() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { health, edit, project: projectSearch } = Route.useSearch()
  const { data: snapshot, isLoading, isError, error, refetch } = useQuery(snapshotQueryOptions())
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [defaultValues, setDefaultValues] = useState<VpsFormValues>(EMPTY_FORM)
  const [filters, setFilters] = useState<VpsFiltersState>(buildDefaultVpsFilters())
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  useEffect(() => {
    if (!health) return
    setFilters((prev) => ({ ...prev, status: prev.status.length ? prev.status : ['active'] }))
  }, [health])

  useEffect(() => {
    if (!projectSearch) return
    setFilters((prev) => ({
      ...prev,
      project: prev.project.length ? prev.project : [projectSearch],
    }))
  }, [projectSearch])

  useEffect(() => {
    if (!edit || !snapshot) return
    const row = snapshot.vps.find((v) => v.id === edit)
    if (row) {
      setEditingId(row.id)
      setDefaultValues(vpsFormFromRow(row))
      setSheetOpen(true)
      void navigate({ to: '/vps', search: { edit: undefined }, replace: true })
    }
  }, [edit, snapshot, navigate])

  const settings = snapshot?.settings[0]
  const { data: rawRates } = useQuery(ratesQueryOptions(settings?.ratesUrl))
  const ratesData = normalizeRatesPayload(rawRates) ?? rawRates ?? null

  const createMutation = useMutation({
    mutationFn: (record: VpsFormValues) => api.create('vps', record as unknown as Vps),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['snapshot'] })
      toast.success('VPS создан')
      setSheetOpen(false)
    },
    onError: (e: unknown) => toast.error(e instanceof ApiError ? e.message : 'Ошибка создания'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Vps> }) =>
      api.update<Vps>('vps', id, patch),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['snapshot'] })
      toast.success('VPS обновлён')
      setSheetOpen(false)
    },
    onError: (e: unknown) => toast.error(e instanceof ApiError ? e.message : 'Ошибка обновления'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.remove<Vps>('vps', id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['snapshot'] })
      toast.success('VPS удалён')
    },
    onError: (e: unknown) => toast.error(e instanceof ApiError ? e.message : 'Ошибка удаления'),
  })

  const bulkMutation = useMutation({
    mutationFn: (payload: { ids: string[]; action: string; value?: unknown }) =>
      api.bulkUpdateVps(payload.ids, payload.action, payload.value),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['snapshot'] })
      setSelectedIds([])
      toast.success('Массовое действие выполнено')
    },
    onError: (e: unknown) => toast.error(e instanceof ApiError ? e.message : 'Ошибка'),
  })

  const openCreate = () => {
    setEditingId(null)
    setDefaultValues({
      ...EMPTY_FORM,
      providerId: snapshot?.providers[0]?.id ?? '',
      providerAccountId: snapshot?.providerAccounts[0]?.id ?? '',
    })
    setSheetOpen(true)
  }
  const openEdit = (v: Vps) => {
    setEditingId(v.id)
    setDefaultValues(vpsFormFromRow(v))
    setSheetOpen(true)
  }
  const submit = (values: VpsFormValues) => {
    const { userOverrides: _ignored, ...rest } = values
    const payload = {
      ...rest,
      customData: JSON.stringify(values.customData ?? {}),
    } as unknown as Partial<Vps>
    if (editingId) {
      void updateMutation.mutate({ id: editingId, patch: payload })
    } else {
      void createMutation.mutate(payload as unknown as VpsFormValues)
    }
  }

  const providerById = snapshot ? providerByIdMap(snapshot.providers) : new Map()

  const projectNameOptions = useMemo(() => {
    const names = new Set<string>()
    for (const p of snapshot?.serverProjects ?? []) {
      const name = (p as { name?: string }).name?.trim()
      if (name) names.add(name)
    }
    for (const v of snapshot?.vps ?? []) {
      const p = (v.project || '').trim()
      if (p) names.add(p)
    }
    return [...names].sort((a, b) => a.localeCompare(b, 'ru'))
  }, [snapshot])

  const projectFormOptions = useMemo(() => {
    const colorByName = new Map<string, string | null>()
    for (const p of snapshot?.serverProjects ?? []) {
      const row = p as { name?: string; color?: string | null }
      const name = row.name?.trim()
      if (name) colorByName.set(name, row.color ?? null)
    }
    return projectNameOptions.map((name) => {
      const color = colorByName.get(name)
      return {
        value: name,
        label: name,
        leading: color ? (
          <ProjectColorDot color={color} className="ring-1 ring-foreground/10" />
        ) : undefined,
      }
    })
  }, [snapshot?.serverProjects, projectNameOptions])

  const filteredVps = useMemo(() => {
    const now = new Date()
    const paidUntilCtx = snapshot
      ? {
          vps: snapshot.vps,
          providerAccounts: snapshot.providerAccounts,
          payments: snapshot.payments,
          balanceLedger: snapshot.balanceLedger,
          now,
        }
      : undefined
    let rows = applyVpsFilters(snapshot?.vps ?? [], filters, paidUntilCtx)
    if (!health || !snapshot) return rows
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const ctx = paidUntilCtx!
    if (health === 'no-rate') {
      rows = rows.filter((v) => {
        if (v.status !== 'active') return false
        const dr = Number(v.dailyRate || 0)
        const mr = Number(v.monthlyRate || 0)
        const noMoney = (!Number.isFinite(dr) || dr <= 0) && (!Number.isFinite(mr) || mr <= 0)
        const noCur = !(v.currency || '').trim()
        return noMoney || noCur
      })
    } else if (health === 'paid-overdue') {
      rows = rows.filter((v) => {
        if (v.status !== 'active') return false
        const d = getPaidUntilDate(v, ctx)
        return d != null && d < todayStart
      })
    } else if (health === 'expiring-soon') {
      const in7Days = new Date(now)
      in7Days.setDate(in7Days.getDate() + 7)
      rows = rows.filter((v) => {
        if (v.status !== 'active') return false
        const d = getPaidUntilDate(v, ctx)
        if (d == null) return false
        return d >= todayStart && d <= in7Days
      })
    }
    return rows
  }, [snapshot, filters, health])

  const dbCountryNames = useMemo(() => {
    const names = new Set<string>()
    for (const v of snapshot?.vps ?? []) {
      const c = (v.country || '').trim()
      if (c) names.add(c)
    }
    return names
  }, [snapshot?.vps])

  const mapCountryOptions = (names: Iterable<string>) =>
    [...names].sort((a, b) => a.localeCompare(b, 'ru')).map((name) => {
      const ref = COUNTRY_BY_NAME_RU[name.toLowerCase()]
      return {
        value: name,
        label: name,
        code: ref?.code,
        leading: <CountryFlag code={ref?.code} country={name} />,
      }
    })

  const filterCountryOptions = useMemo(
    () => mapCountryOptions(dbCountryNames),
    [dbCountryNames],
  )

  const formCountryOptions = useMemo(() => {
    const names = new Set(dbCountryNames)
    for (const c of COUNTRIES) names.add(c.name)
    return mapCountryOptions(names)
  }, [dbCountryNames])

  const filterCityOptions = useMemo(
    () => buildCityOptions(snapshot?.vps, filters.country[0], { includeCatalog: false }),
    [snapshot?.vps, filters.country],
  )

  const tableSections = useMemo(() => {
    if (!filters.groupByProject) {
      return [{ key: '_flat', label: null as string | null, items: filteredVps }]
    }
    const map = new Map<string, Vps[]>()
    for (const item of filteredVps) {
      const key = (item.project || '').trim() || '__none__'
      const arr = map.get(key) ?? []
      arr.push(item)
      map.set(key, arr)
    }
    const keys = [...map.keys()].sort((a, b) => {
      if (a === '__none__') return 1
      if (b === '__none__') return -1
      return a.localeCompare(b, 'ru')
    })
    return keys.map((key) => ({
      key,
      label: key === '__none__' ? 'Без проекта' : key,
      items: map.get(key) ?? [],
    }))
  }, [filteredVps, filters.groupByProject])

  const customFieldDefs = useMemo(
    () => parseCustomFieldDefs((settings as { customFields?: unknown })?.customFields),
    [settings],
  )

  const customColumnVisibility = useMemo(
    () => buildCustomFieldColumnVisibility(customFieldDefs),
    [customFieldDefs],
  )

  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() => ({
    ...(loadStoredColumnVisibility('vps-column-visibility') ?? {}),
  }))

  useEffect(() => {
    setColumnVisibility((prev) => ({ ...customColumnVisibility, ...prev }))
  }, [customColumnVisibility])

  useEffect(() => {
    localStorage.setItem('vps-column-visibility', JSON.stringify(columnVisibility))
  }, [columnVisibility])

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

  const columns: DataGridColumn<Vps>[] = useMemo(() => {
    const base: DataGridColumn<Vps>[] = [
    {
      key: 'ip',
      header: 'IP / DNS',
      icon: GlobeIcon,
      sortValue: (v) => v.ip || v.dns || '',
      cell: (v) => dataGridCellStack(
        <Button variant="link" className="h-auto p-0 font-normal" render={<Link to="/vps/$vpsId" params={{ vpsId: v.id }} />}>
          {v.ip || '—'}
        </Button>,
        v.dns || undefined,
      ),
    },
    {
      key: 'domains',
      header: 'Домены',
      icon: GlobeIcon,
      sortValue: (v) =>
        (snapshot?.vpsDomains ?? [])
          .filter((d) => d.vpsId === v.id)
          .map((d) => d.fqdn)
          .join(', '),
      cell: (v) => (
        <VpsDomainsCell domains={(snapshot?.vpsDomains ?? []).filter((d) => d.vpsId === v.id)} />
      ),
    },
    {
      key: 'account',
      header: 'Аккаунт',
      icon: UserRoundIcon,
      sortValue: (v) => {
        const acc = snapshot?.providerAccounts.find((a) => a.id === v.providerAccountId)
        return acc ? accountSelectLabel(acc, providerById) : ''
      },
      cell: (v) => {
        const acc = snapshot?.providerAccounts.find((a) => a.id === v.providerAccountId)
        if (!acc) return '—'
        const providerName = providerById.get(acc.providerId)?.name ?? '—'
        return dataGridCellStack(acc.name, providerName)
      },
    },
    {
      key: 'location',
      header: 'Локация',
      icon: MapPinIcon,
      sortValue: (v) => [v.country, v.city].filter(Boolean).join(', '),
      cell: (v) => {
        const country = v.country?.trim()
        const city = v.city?.trim()
        if (!country && !city) return <span className="text-muted-foreground">—</span>
        const primary = country || city || '—'
        const secondary = country && city ? city : undefined
        const flag = country ? <CountryFlag country={country} /> : null
        return flag
          ? dataGridCellWithFlag(flag, primary, secondary)
          : dataGridCellStack(primary, secondary)
      },
    },
    {
      key: 'project',
      header: 'Проект',
      icon: FolderKanbanIcon,
      cell: (v) => <span className="text-muted-foreground">{v.project || '—'}</span>,
    },
    {
      key: 'specs',
      header: 'Ресурсы',
      icon: CpuIcon,
      sortValue: (v) => v.vcpu,
      cell: (v) => (
        <span className="tabular-nums text-muted-foreground">
          {v.vcpu} vCPU / {v.ramGb} GB / {v.diskGb} GB
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Статус',
      icon: CircleDotIcon,
      cell: (v) => (
        <Badge variant={v.status === 'active' ? 'default' : v.status === 'archived' ? 'outline' : 'secondary'}>
          {vpsStatusLabel(v.status)}
        </Badge>
      ),
    },
    {
      key: 'tariff',
      header: 'Тариф',
      icon: CreditCardIcon,
      sortValue: (v) => vpsTariffMonthlyBurn(v),
      cell: (v) => {
        const provider = providerById.get(v.providerId)
        const currency = effectiveVpsTariffCurrency(v, provider)
        const amount = vpsTariffRateAmount(v)
        return dataGridCellStack(
          formatInProviderCurrency(amount, currency, provider, snapshot?.settings ?? null, ratesData),
          tariffTypeLabel(v.tariffType),
        )
      },
    },
    {
      key: 'health',
      header: 'Мониторинг',
      icon: ActivityIcon,
      sortable: false,
      cell: (v) => {
        const ext = v as Vps & { lastHealthStatus?: string; monitoringEnabled?: boolean }
        if (!ext.monitoringEnabled) return <span className="text-muted-foreground">—</span>
        if (ext.lastHealthStatus === 'up') return <Badge variant="default">up</Badge>
        if (ext.lastHealthStatus === 'down') return <Badge variant="destructive">down</Badge>
        return <Badge variant="outline">—</Badge>
      },
    },
    {
      key: 'paidUntil',
      header: 'Оплачено до',
      icon: CalendarIcon,
      sortValue: (v) => {
        if (!snapshot) return ''
        const d = getPaidUntilDate(v, {
          vps: snapshot.vps,
          providerAccounts: snapshot.providerAccounts,
          payments: snapshot.payments,
          balanceLedger: snapshot.balanceLedger,
          now: new Date(),
        })
        return d?.getTime() ?? 0
      },
      cell: (v) => {
        if (!snapshot) return '—'
        const d = getPaidUntilDate(v, {
          vps: snapshot.vps,
          providerAccounts: snapshot.providerAccounts,
          payments: snapshot.payments,
          balanceLedger: snapshot.balanceLedger,
          now: new Date(),
        })
        if (!d) return <span className="text-muted-foreground">—</span>
        const todayStart = new Date()
        todayStart.setHours(0, 0, 0, 0)
        const overdue = d < todayStart
        return (
          <span className={overdue ? 'text-destructive tabular-nums' : 'tabular-nums text-muted-foreground'}>
            {d.toLocaleDateString('ru-RU')}
          </span>
        )
      },
    },
    {
      key: 'actions',
      header: '',
      sortable: false,
      enableHiding: false,
      className: 'w-24 text-right',
      cell: (v) => (
        <RowActions
          onEdit={() => openEdit(v)}
          onDelete={() => deleteMutation.mutate(v.id)}
          deleteTitle="Удалить VPS?"
          deleteDescription={`IP ${v.ip} будет удалён безвозвратно.`}
        />
      ),
    },
    ]
    const customCols = buildCustomFieldColumns<Vps>(customFieldDefs)
    const actionsCol = base.pop()!
    return [...base, ...customCols, actionsCol]
  }, [
    snapshot,
    providerById,
    ratesData,
    customFieldDefs,
    deleteMutation,
  ])

  const columnVisibilityOptions = useMemo(
    () => dataGridColumnVisibilityOptions(columns),
    [columns],
  )

  return (
    <PageShell>
      <PageHeader
        title="VPS"
        description="Виртуальные серверы"
        actions={
          <Button onClick={openCreate}>
            <PlusIcon data-icon="inline-start" />
            Добавить
          </Button>
        }
      />

      {snapshot?.vpsDomains?.length ? (
        <UnmatchedDomainsBanner domains={snapshot.vpsDomains} />
      ) : null}

      <QueryState
        data={snapshot}
        isLoading={isLoading}
        isError={isError}
        error={error}
        onRetry={() => refetch()}
        skeleton={<TableSkeleton />}
        empty={snapshot?.vps.length === 0}
        emptyTitle="VPS не найдены"
        emptyDescription="Добавьте первый виртуальный сервер"
        emptyAction={
          <Button onClick={openCreate}>
            <PlusIcon data-icon="inline-start" />
            Добавить VPS
          </Button>
        }
      >
        {(snap) => {
          const filtersActive = hasActiveVpsFilters(filters)
          const zeroResults =
            snap.vps.length > 0 && filteredVps.length === 0 && (filtersActive || Boolean(health))

          const resetFilters = () => {
            setFilters(buildDefaultVpsFilters())
            if (health) {
              void navigate({ to: '/vps', search: {} })
            }
          }

          if (zeroResults) {
            return (
              <div className="flex flex-col gap-4">
                {health ? <HealthModeBanner health={health} exitTo="/vps" /> : null}
                <VpsFiltersToolbar
                  filters={filters}
                  onChange={setFilters}
                  providers={snap.providers}
                  providerAccounts={snap.providerAccounts}
                  vps={snap.vps}
                  projectNameOptions={projectNameOptions}
                  countryOptions={filterCountryOptions}
                  cityOptions={filterCityOptions}
                  shownCount={filteredVps.length}
                  totalCount={snap.vps.length}
                  columnVisibilityOptions={columnVisibilityOptions}
                  columnVisibility={columnVisibility}
                  onColumnVisibilityChange={handleColumnVisibilityChange}
                />
                <EmptyState
                  title="Ничего не найдено"
                  description="По текущим фильтрам VPS не найдены"
                  action={
                    <Button variant="outline" onClick={resetFilters}>
                      {health ? 'Выйти из режима и сбросить фильтры' : 'Сбросить фильтры'}
                    </Button>
                  }
                />
              </div>
            )
          }

          return (
          <div className="flex flex-col gap-4">
            {health ? <HealthModeBanner health={health} exitTo="/vps" /> : null}
            <VpsBulkToolbar
              selectedCount={selectedIds.length}
              projectOptions={projectNameOptions}
              busy={bulkMutation.isPending}
              onSetStatus={(status) => bulkMutation.mutate({ ids: selectedIds, action: 'status', value: status })}
              onSetProject={(project) => bulkMutation.mutate({ ids: selectedIds, action: 'project', value: project })}
              onDelete={() => bulkMutation.mutate({ ids: selectedIds, action: 'delete' })}
            />
            <VpsFiltersToolbar
              filters={filters}
              onChange={setFilters}
              providers={snap.providers}
              providerAccounts={snap.providerAccounts}
              vps={snap.vps}
              projectNameOptions={projectNameOptions}
              countryOptions={filterCountryOptions}
              cityOptions={filterCityOptions}
              shownCount={filteredVps.length}
              totalCount={snap.vps.length}
              columnVisibilityOptions={columnVisibilityOptions}
              columnVisibility={columnVisibility}
              onColumnVisibilityChange={handleColumnVisibilityChange}
            />
            {tableSections.map((section) => (
              <DataGridCard
                key={section.key}
                title={section.label ?? undefined}
                columns={columnDefFromDataGrid(columns)}
                data={section.items}
                rowId={(v) => v.id}
                emptyTitle="VPS не найдены"
                pinLastColumn
                dense={filters.tableCompact}
                enableRowSelection
                onRowSelectionChange={setSelectedIds}
                virtualization={section.items.length > 200}
                height={560}
                enableColumnVisibility
                columnVisibility={columnVisibility}
                onColumnVisibilityChange={setColumnVisibility}
                columnVisibilityTrigger={false}
              />
            ))}
          </div>
          )
        }}
      </QueryState>

      {snapshot ? (
        <VpsEditSheet
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          editingId={editingId}
          defaultValues={defaultValues}
          providers={snapshot.providers}
          providerAccounts={snapshot.providerAccounts}
          vpsRows={snapshot.vps}
          formCountryOptions={formCountryOptions}
          projectFormOptions={projectFormOptions}
          customFieldDefs={parseCustomFieldDefs(
            (snapshot.settings[0] as { customFields?: unknown })?.customFields,
          )}
          onSubmit={submit}
          submitting={createMutation.isPending || updateMutation.isPending}
        />
      ) : null}
    </PageShell>
  )
}
