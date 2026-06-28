import { Controller } from 'react-hook-form'
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
import { FormDatePicker } from '@/components/form-date-picker'
import { vpsSchema, type VpsFormValues } from '@/lib/schemas'
import { vpsStatusLabel, tariffTypeLabel } from '@/lib/format'
import { buildCityOptions, cityMatchesCountry, resolveCountryForCityFromRows } from '@cfdm/shared/geo'
import type { Provider, ProviderAccount, Vps } from '@/types/entities'
import type { ZodType } from 'zod'

export const VPS_FORM_EMPTY: VpsFormValues = {
  ip: '',
  dns: '',
  providerId: '',
  providerAccountId: '',
  country: '',
  city: '',
  datacenter: '',
  vcpu: 1,
  ramGb: 1,
  diskGb: 10,
  status: 'active',
  tariffType: 'monthly',
  currency: 'RUB',
  monthlyRate: 0,
  dailyRate: 0,
  paidUntil: '',
  project: '',
  notes: '',
}

export function vpsFormFromRow(v: Vps): VpsFormValues {
  return {
    id: v.id,
    ip: v.ip,
    dns: v.dns ?? '',
    providerId: v.providerId,
    providerAccountId: v.providerAccountId,
    country: v.country ?? '',
    city: v.city ?? '',
    datacenter: v.datacenter ?? '',
    vcpu: v.vcpu,
    ramGb: v.ramGb,
    diskGb: v.diskGb,
    status: v.status,
    tariffType: v.tariffType,
    currency: v.currency,
    monthlyRate: Number(v.monthlyRate ?? 0),
    dailyRate: Number(v.dailyRate ?? 0),
    paidUntil: v.paidUntil ?? '',
    project: v.project ?? '',
    notes: v.notes ?? '',
  }
}

interface VpsEditSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editingId: string | null
  defaultValues: VpsFormValues
  providers: Provider[]
  providerAccounts: ProviderAccount[]
  vpsRows: Vps[]
  formCountryOptions: Array<{ value: string; label: string }>
  onSubmit: (values: VpsFormValues) => void
  submitting?: boolean
}

export function VpsEditSheet({
  open,
  onOpenChange,
  editingId,
  defaultValues,
  providers,
  providerAccounts,
  vpsRows,
  formCountryOptions,
  onSubmit,
  submitting,
}: VpsEditSheetProps) {
  return (
    <FormSheetRhf
      open={open}
      onOpenChange={onOpenChange}
      title={editingId ? 'Редактировать VPS' : 'Новый VPS'}
      description="Заполните параметры сервера"
      schema={vpsSchema as unknown as ZodType<VpsFormValues>}
      defaultValues={defaultValues}
      onSubmit={onSubmit}
      submitting={submitting}
    >
      {(form) => {
        const { register, formState: { errors }, watch, setValue, control } = form
        const providerId = watch('providerId')
        const formCountry = watch('country') ?? ''
        const formCity = watch('city') ?? ''
        const formCityOptions = buildCityOptions(vpsRows, formCountry.trim() || undefined)

        return (
          <>
            <FormField label="IP" htmlFor="vps-ip" error={errors.ip?.message} invalid={!!errors.ip}>
              <Input id="vps-ip" aria-invalid={!!errors.ip} {...register('ip')} />
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
                options={providers.map((p) => ({ value: p.id, label: p.name }))}
              />
            </FormField>
            <FormField label="Аккаунт" htmlFor="vps-account" error={errors.providerAccountId?.message}>
              <SelectField
                triggerId="vps-account"
                placeholder="Выберите аккаунт"
                value={watch('providerAccountId')}
                onValueChange={(v) => setValue('providerAccountId', v ?? '', { shouldValidate: true })}
                options={providerAccounts
                  .filter((a) => !providerId || a.providerId === providerId)
                  .map((a) => ({ value: a.id, label: a.name }))}
              />
            </FormField>
            <FormField label="Проект" htmlFor="vps-project">
              <Input id="vps-project" {...register('project')} />
            </FormField>
            <FormField label="Страна" htmlFor="vps-country">
              <AutoCompleteInput
                id="vps-country"
                placeholder="Любая"
                value={formCountry}
                onChange={(v) => {
                  setValue('country', v)
                  if (v.trim() && formCity.trim() && !cityMatchesCountry(formCity, v, vpsRows)) {
                    setValue('city', '')
                  }
                }}
                options={formCountryOptions}
                searchPlaceholder="Поиск страны…"
                emptyText="Нет вариантов"
              />
            </FormField>
            <FormField label="Город" htmlFor="vps-city">
              <AutoCompleteInput
                id="vps-city"
                placeholder="Любой"
                value={formCity}
                onChange={(v) => {
                  setValue('city', v)
                  const country = resolveCountryForCityFromRows(v, vpsRows)
                  if (country) setValue('country', country)
                }}
                options={formCityOptions}
                searchPlaceholder="Поиск города…"
                emptyText="Нет вариантов"
                showLeadingInInput={false}
              />
            </FormField>
            <FormField label="Дата-центр" htmlFor="vps-dc">
              <Input id="vps-dc" {...register('datacenter')} />
            </FormField>
            <div className="grid grid-cols-3 gap-3">
              <FormField label="vCPU" htmlFor="vps-vcpu" error={errors.vcpu?.message}>
                <Controller
                  control={control}
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
                  control={control}
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
                  control={control}
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
                  onValueChange={(v) => setValue('status', (v ?? 'active') as VpsFormValues['status'])}
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
                  onValueChange={(v) => setValue('tariffType', (v ?? 'monthly') as VpsFormValues['tariffType'])}
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
                  control={control}
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
                  control={control}
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
                control={control}
                name="paidUntil"
                render={({ field }) => (
                  <FormDatePicker
                    id="vps-paid"
                    value={(field.value as string | undefined) ?? ''}
                    onChange={field.onChange}
                  />
                )}
              />
            </FormField>
            <FormField label="Заметки" htmlFor="vps-notes">
              <Textarea id="vps-notes" {...register('notes')} />
            </FormField>
          </>
        )
      }}
    </FormSheetRhf>
  )
}
