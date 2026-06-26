import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useMemo } from 'react'
import { Controller } from 'react-hook-form'
import { PlusIcon, PencilIcon, Trash2Icon } from 'lucide-react'
import { toast } from 'sonner'
import { format, parseISO, isValid } from 'date-fns'

import { snapshotQueryOptions, ratesQueryOptions } from '@/queries/snapshot'
import { api, ApiError } from '@/lib/api-client'
import { vpsSchema, type VpsFormValues } from '@/lib/schemas'
import { normalizeRatesPayload, effectiveVpsTariffCurrency, formatInProviderCurrency } from '@/lib/format'
import { PageShell } from '@/components/page-shell'
import { PageHeader } from '@/components/page-header'
import { Button } from '@cfdm/ui/components/button'
import { Badge } from '@cfdm/ui/components/badge'
import { DataTableCard, type DataTableColumn } from '@/components/data-table-card'
import { QueryState } from '@/components/query-state'
import { TableSkeleton } from '@/components/skeletons'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { FormSheetRhf } from '@/components/form-sheet-rhf'
import { FormField } from '@/components/form-field'
import { Input } from '@cfdm/ui/components/input'
import { SelectField } from '@/components/select-field'
import { AutoCompleteInput } from '@/components/auto-complete-input'
import { Textarea } from '@cfdm/ui/components/textarea'
import {
  NumberField,
  NumberFieldGroup,
  NumberFieldDecrement,
  NumberFieldIncrement,
  NumberFieldInput,
} from '@/components/reui/number-field'
import {
  DateSelector,
  type DateSelectorValue,
} from '@/components/reui/date-selector'
import {
  applyVpsFilters,
  buildDefaultVpsFilters,
  type VpsFiltersState,
} from '@/components/vps-filters'
import { VpsFiltersToolbar } from '@/components/vps-filters-toolbar'

import type { Vps } from '@/types/entities'
import { vpsStatusLabel, tariffTypeLabel, getCountryFlagEmoji, getCountryFlagEmojiByCode } from '@/lib/format'
import { providerByIdMap, accountSelectLabel } from '@/lib/billmanager'
import { COUNTRIES, COUNTRY_BY_NAME_RU, listCities } from '@cfdm/shared/geo'

export const Route = createFileRoute('/_auth/vps')({
  loader: ({ context: { queryClient } }) =>
    queryClient.ensureQueryData(snapshotQueryOptions()),
  component: VpsPage,
})

const EMPTY_FORM: VpsFormValues = {
  ip: '', dns: '', providerId: '', providerAccountId: '',
  country: '', city: '', datacenter: '',
  vcpu: 1, ramGb: 1, diskGb: 10, status: 'active', tariffType: 'monthly',
  currency: 'RUB', monthlyRate: 0, dailyRate: 0, paidUntil: '', project: '', notes: '',
}

function VpsPage() {
  const queryClient = useQueryClient()
  const { data: snapshot, isLoading, isError, error, refetch } = useQuery(snapshotQueryOptions())
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [defaultValues, setDefaultValues] = useState<VpsFormValues>(EMPTY_FORM)
  const [filters, setFilters] = useState<VpsFiltersState>(buildDefaultVpsFilters())

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
    setDefaultValues({
      id: v.id, ip: v.ip, dns: v.dns ?? '', providerId: v.providerId, providerAccountId: v.providerAccountId,
      country: v.country ?? '', city: v.city ?? '', datacenter: v.datacenter ?? '',
      vcpu: v.vcpu, ramGb: v.ramGb, diskGb: v.diskGb, status: v.status, tariffType: v.tariffType,
      currency: v.currency, monthlyRate: Number(v.monthlyRate ?? 0), dailyRate: Number(v.dailyRate ?? 0),
      paidUntil: v.paidUntil ?? '', project: v.project ?? '', notes: v.notes ?? '',
    })
    setSheetOpen(true)
  }
  const submit = (values: VpsFormValues) => {
    if (editingId) {
      void updateMutation.mutate({ id: editingId, patch: values as unknown as Partial<Vps> })
    } else {
      void createMutation.mutate(values)
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

  const filteredVps = useMemo(
    () => applyVpsFilters(snapshot?.vps ?? [], filters),
    [snapshot?.vps, filters],
  )

  const countryOptions = useMemo(() => {
    const names = new Set<string>()
    // Из существующих VPS — могут быть произвольные строки
    for (const v of snapshot?.vps ?? []) {
      const c = (v.country || '').trim()
      if (c) names.add(c)
    }
    // Из стандартизированного справочника
    for (const c of COUNTRIES) names.add(c.name)
    return [...names].sort((a, b) => a.localeCompare(b, 'ru')).map((name) => {
      const ref = COUNTRY_BY_NAME_RU[name.toLowerCase()]
      return {
        value: name,
        label: name,
        code: ref?.code,
        leading: ref ? getCountryFlagEmojiByCode(ref.code) : getCountryFlagEmoji(name),
      }
    })
  }, [snapshot?.vps])

  const cityOptions = useMemo(() => {
    const names = new Set<string>()
    // Из существующих VPS
    for (const v of snapshot?.vps ?? []) {
      const c = (v.city || '').trim()
      if (c) names.add(c)
    }
    // Из стандартизированного справочника (фильтр по первой выбранной стране, если есть)
    const countryCode = filters.country[0]
      ? COUNTRY_BY_NAME_RU[filters.country[0].toLowerCase()]?.code
      : undefined
    for (const city of listCities(countryCode)) names.add(city.name)
    return [...names].sort((a, b) => a.localeCompare(b, 'ru')).map((name) => ({
      value: name,
      label: name,
    }))
  }, [snapshot?.vps, filters.country])

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

  const columns: DataTableColumn<Vps>[] = [
    {
      key: 'ip',
      header: 'IP / DNS',
      cell: (v) => (
        <div className="flex flex-col">
          <span className="font-medium">{v.ip || '—'}</span>
          {v.dns ? <span className="text-xs text-muted-foreground">{v.dns}</span> : null}
        </div>
      ),
    },
    {
      key: 'account',
      header: 'Аккаунт',
      cell: (v) => {
        const acc = snapshot?.providerAccounts.find((a) => a.id === v.providerAccountId)
        return acc ? accountSelectLabel(acc, providerById) : '—'
      },
    },
    { key: 'project', header: 'Проект', cell: (v) => <span className="text-muted-foreground">{v.project || '—'}</span> },
    {
      key: 'specs',
      header: 'Ресурсы',
      cell: (v) => (
        <span className="tabular-nums text-muted-foreground">
          {v.vcpu} vCPU / {v.ramGb} GB / {v.diskGb} GB
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Статус',
      cell: (v) => (
        <Badge variant={v.status === 'active' ? 'default' : v.status === 'archived' ? 'outline' : 'secondary'}>
          {vpsStatusLabel(v.status)}
        </Badge>
      ),
    },
    {
      key: 'tariff',
      header: 'Тариф',
      cell: (v) => {
        const provider = providerById.get(v.providerId)
        const currency = effectiveVpsTariffCurrency(v, provider)
        const amount = v.tariffType === 'daily' ? Number(v.dailyRate || 0) * 30 : Number(v.monthlyRate || 0)
        return (
          <span className="tabular-nums">
            {formatInProviderCurrency(amount, currency, provider, snapshot?.settings ?? [], ratesData)}
            <span className="ml-1 text-xs text-muted-foreground">{tariffTypeLabel(v.tariffType)}</span>
          </span>
        )
      },
    },
    {
      key: 'actions',
      header: '',
      className: 'w-24 text-right',
      cell: (v) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon-sm" onClick={() => openEdit(v)} aria-label="Редактировать">
            <PencilIcon />
          </Button>
          <ConfirmDialog
            trigger={
              <Button variant="ghost" size="icon-sm" aria-label="Удалить">
                <Trash2Icon />
              </Button>
            }
            title="Удалить VPS?"
            description={`IP ${v.ip} будет удалён безвозвратно.`}
            destructive
            confirmLabel="Удалить"
            onConfirm={() => deleteMutation.mutate(v.id)}
          />
        </div>
      ),
    },
  ]

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
        {(snap) => (
          <div className="flex flex-col gap-4">
            <VpsFiltersToolbar
              filters={filters}
              onChange={setFilters}
              providers={snap.providers}
              providerAccounts={snap.providerAccounts}
              vps={snap.vps}
              projectNameOptions={projectNameOptions}
              countryOptions={countryOptions}
              cityOptions={cityOptions}
            />
            {tableSections.map((section) => (
              <DataTableCard
                key={section.key}
                title={section.label ?? undefined}
                columns={columns}
                data={section.items}
                rowKey={(v) => v.id}
                emptyTitle="VPS не найдены"
              />
            ))}
          </div>
        )}
      </QueryState>

      <FormSheetRhf
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        title={editingId ? 'Редактировать VPS' : 'Новый VPS'}
        description="Заполните параметры сервера"
        schema={vpsSchema as unknown as import('zod').ZodType<VpsFormValues>}
        defaultValues={defaultValues}
        onSubmit={submit}
        submitting={createMutation.isPending || updateMutation.isPending}
      >
        {(form) => {
          const { register, formState: { errors }, watch, setValue } = form
          const providerId = watch('providerId')
          return (
            <>
              <FormField label="IP" htmlFor="vps-ip" error={errors.ip?.message} invalid={!!errors.ip}>
                <Input id="vps-ip" {...register('ip')} />
              </FormField>
              <FormField label="DNS" htmlFor="vps-dns">
                <Input id="vps-dns" {...register('dns')} />
              </FormField>
              <FormField label="Хостер" htmlFor="vps-provider" error={errors.providerId?.message}>
                <SelectField
                  triggerId="vps-provider"
                  placeholder="Выберите хостера"
                  value={providerId}
                  onValueChange={(v) => setValue('providerId', v ?? '', { shouldValidate: true })}
                  options={(snapshot?.providers ?? []).map((p) => ({ value: p.id, label: p.name }))}
                />
              </FormField>
              <FormField label="Аккаунт" htmlFor="vps-account" error={errors.providerAccountId?.message}>
                <SelectField
                  triggerId="vps-account"
                  placeholder="Выберите аккаунт"
                  value={watch('providerAccountId')}
                  onValueChange={(v) => setValue('providerAccountId', v ?? '', { shouldValidate: true })}
                  options={(snapshot?.providerAccounts ?? [])
                    .filter((a) => !providerId || a.providerId === providerId)
                    .map((a) => ({ value: a.id, label: a.name }))}
                />
              </FormField>
              <FormField label="Проект" htmlFor="vps-project">
                <Input id="vps-project" {...register('project')} />
              </FormField>
              <div className="grid grid-cols-3 gap-3">
                <FormField label="Страна" htmlFor="vps-country">
                  <AutoCompleteInput
                    id="vps-country"
                    placeholder="Любая"
                    value={watch('country') ?? ''}
                    onChange={(v) => setValue('country', v)}
                    options={countryOptions}
                    searchPlaceholder="Поиск страны…"
                    emptyText="Нет вариантов"
                  />
                </FormField>
                <FormField label="Город" htmlFor="vps-city">
                  <AutoCompleteInput
                    id="vps-city"
                    placeholder="Любой"
                    value={watch('city') ?? ''}
                    onChange={(v) => setValue('city', v)}
                    options={cityOptions}
                    searchPlaceholder="Поиск города…"
                    emptyText="Нет вариантов"
                    showLeadingInInput={false}
                  />
                </FormField>
                <FormField label="Дата-центр" htmlFor="vps-dc">
                  <Input id="vps-dc" {...register('datacenter')} />
                </FormField>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <FormField label="vCPU" htmlFor="vps-vcpu" error={errors.vcpu?.message}>
                  <Controller
                    control={form.control}
                    name="vcpu"
                    render={({ field }) => (
                      <NumberField
                        id="vps-vcpu"
                        min={0}
                        step={1}
                        value={Number(field.value ?? 0)}
                        onValueChange={(val) => field.onChange(val ?? 0)}
                      >
                        <NumberFieldGroup>
                          <NumberFieldDecrement />
                          <NumberFieldInput />
                          <NumberFieldIncrement />
                        </NumberFieldGroup>
                      </NumberField>
                    )}
                  />
                </FormField>
                <FormField label="RAM (GB)" htmlFor="vps-ram" error={errors.ramGb?.message}>
                  <Controller
                    control={form.control}
                    name="ramGb"
                    render={({ field }) => (
                      <NumberField
                        id="vps-ram"
                        min={0}
                        step={1}
                        value={Number(field.value ?? 0)}
                        onValueChange={(val) => field.onChange(val ?? 0)}
                      >
                        <NumberFieldGroup>
                          <NumberFieldDecrement />
                          <NumberFieldInput />
                          <NumberFieldIncrement />
                        </NumberFieldGroup>
                      </NumberField>
                    )}
                  />
                </FormField>
                <FormField label="Disk (GB)" htmlFor="vps-disk" error={errors.diskGb?.message}>
                  <Controller
                    control={form.control}
                    name="diskGb"
                    render={({ field }) => (
                      <NumberField
                        id="vps-disk"
                        min={0}
                        step={1}
                        value={Number(field.value ?? 0)}
                        onValueChange={(val) => field.onChange(val ?? 0)}
                      >
                        <NumberFieldGroup>
                          <NumberFieldDecrement />
                          <NumberFieldInput />
                          <NumberFieldIncrement />
                        </NumberFieldGroup>
                      </NumberField>
                    )}
                  />
                </FormField>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Статус" htmlFor="vps-status">
                  <SelectField
                    triggerId="vps-status"
                    value={watch('status')}
                    onValueChange={(v) => setValue('status', (v ?? 'active') as 'active' | 'paused' | 'archived')}
                    options={[
                      { value: 'active', label: vpsStatusLabel('active') },
                      { value: 'paused', label: vpsStatusLabel('paused') },
                      { value: 'archived', label: vpsStatusLabel('archived') },
                    ]}
                  />
                </FormField>
                <FormField label="Тип тарифа" htmlFor="vps-tariff">
                  <SelectField
                    triggerId="vps-tariff"
                    value={watch('tariffType')}
                    onValueChange={(v) => setValue('tariffType', (v ?? 'monthly') as 'daily' | 'monthly')}
                    options={[
                      { value: 'monthly', label: tariffTypeLabel('monthly') },
                      { value: 'daily', label: tariffTypeLabel('daily') },
                    ]}
                  />
                </FormField>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <FormField label="Валюта" htmlFor="vps-cur" error={errors.currency?.message}>
                  <Input id="vps-cur" {...register('currency')} />
                </FormField>
                <FormField label="Ставка/мес" htmlFor="vps-monthly">
                  <Controller
                    control={form.control}
                    name="monthlyRate"
                    render={({ field }) => (
                      <NumberField
                        id="vps-monthly"
                        min={0}
                        step={0.01}
                        value={Number(field.value ?? 0)}
                        onValueChange={(val) => field.onChange(val ?? 0)}
                      >
                        <NumberFieldGroup>
                          <NumberFieldDecrement />
                          <NumberFieldInput />
                          <NumberFieldIncrement />
                        </NumberFieldGroup>
                      </NumberField>
                    )}
                  />
                </FormField>
                <FormField label="Ставка/день" htmlFor="vps-daily">
                  <Controller
                    control={form.control}
                    name="dailyRate"
                    render={({ field }) => (
                      <NumberField
                        id="vps-daily"
                        min={0}
                        step={0.01}
                        value={Number(field.value ?? 0)}
                        onValueChange={(val) => field.onChange(val ?? 0)}
                      >
                        <NumberFieldGroup>
                          <NumberFieldDecrement />
                          <NumberFieldInput />
                          <NumberFieldIncrement />
                        </NumberFieldGroup>
                      </NumberField>
                    )}
                  />
                </FormField>
              </div>
              <FormField label="Оплачено до" htmlFor="vps-paid">
                <Controller
                  control={form.control}
                  name="paidUntil"
                  render={({ field }) => {
                    const strVal = (field.value as string | undefined) ?? ''
                    const parsed = strVal ? parseISO(strVal) : undefined
                    const dateVal: DateSelectorValue | undefined =
                      parsed && isValid(parsed)
                        ? { period: 'day', operator: 'is', startDate: parsed }
                        : undefined
                    return (
                      <DateSelector
                        value={dateVal}
                        onChange={(v) => {
                          const d = v.startDate
                          field.onChange(d ? format(d, 'yyyy-MM-dd') : '')
                        }}
                        allowRange={false}
                        defaultPeriodType="day"
                        showInput
                      />
                    )
                  }}
                />
              </FormField>
              <FormField label="Заметки" htmlFor="vps-notes">
                <Textarea id="vps-notes" {...register('notes')} />
              </FormField>
            </>
          )
        }}
      </FormSheetRhf>
    </PageShell>
  )
}
