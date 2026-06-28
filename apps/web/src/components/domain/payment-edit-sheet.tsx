import { FormSheetRhf } from '@/components/form-sheet-rhf'
import { FormField } from '@/components/form-field'
import { Input } from '@cfdm/ui/components/input'
import { Textarea } from '@cfdm/ui/components/textarea'
import { SelectField } from '@/components/select-field'
import type { ZodType } from 'zod'
import { paymentSchema, type PaymentFormValues } from '@/lib/schemas'
import type { PaymentType, Provider, ProviderAccount, Vps } from '@/types/entities'
import { paymentTypeLabel } from '@/lib/format'
import { accountSelectLabel, providerByIdMap } from '@/lib/billmanager'

const TODAY = new Date().toISOString().slice(0, 10)

const EMPTY: PaymentFormValues = {
  type: 'provider_balance_topup',
  date: TODAY,
  amount: 0,
  currency: 'RUB',
  providerAccountId: '',
  vpsId: '',
  note: '',
}

interface PaymentEditSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultValues: PaymentFormValues
  providerAccounts: ProviderAccount[]
  providers: Provider[]
  vpsRows: Vps[]
  onSubmit: (values: PaymentFormValues) => void
  submitting?: boolean
}

export function paymentFormDefaults(
  edit?: Partial<PaymentFormValues> | null,
  fallbackAccountId = '',
): PaymentFormValues {
  if (!edit) {
    return { ...EMPTY, providerAccountId: fallbackAccountId }
  }
  return { ...EMPTY, ...edit, vpsId: edit.vpsId ?? '' }
}

export function PaymentEditSheet({
  open,
  onOpenChange,
  defaultValues,
  providerAccounts,
  providers,
  vpsRows,
  onSubmit,
  submitting,
}: PaymentEditSheetProps) {
  const providerById = providerByIdMap(providers)

  return (
    <FormSheetRhf
      open={open}
      onOpenChange={onOpenChange}
      title={defaultValues.id ? 'Редактировать платёж' : 'Новый платёж'}
      schema={paymentSchema as unknown as ZodType<PaymentFormValues>}
      defaultValues={defaultValues}
      onSubmit={onSubmit}
      submitting={submitting}
    >
      {(form) => {
        const { register, formState: { errors }, watch, setValue } = form
        const accountId = watch('providerAccountId')
        const vpsOptions = vpsRows
          .filter((v) => !accountId || v.providerAccountId === accountId)
          .map((v) => ({
            value: v.id,
            label: [v.ip, v.dns, v.project].filter(Boolean).join(' · ') || v.id,
          }))

        return (
          <>
            <FormField label="Тип" htmlFor="pay-type" error={errors.type?.message}>
              <SelectField
                triggerId="pay-type"
                value={watch('type')}
                onValueChange={(v) => setValue('type', (v ?? 'provider_balance_topup') as PaymentType, { shouldValidate: true })}
                options={[
                  { value: 'provider_balance_topup', label: paymentTypeLabel('provider_balance_topup') },
                  { value: 'direct_vps_payment', label: paymentTypeLabel('direct_vps_payment') },
                  { value: 'daily_debit', label: paymentTypeLabel('daily_debit') },
                  { value: 'monthly_debit', label: paymentTypeLabel('monthly_debit') },
                ]}
              />
            </FormField>
            <FormField label="Аккаунт" htmlFor="pay-acc" error={errors.providerAccountId?.message}>
              <SelectField
                triggerId="pay-acc"
                placeholder="Выберите аккаунт"
                value={accountId}
                onValueChange={(v) => {
                  setValue('providerAccountId', v ?? '', { shouldValidate: true })
                  setValue('vpsId', '')
                }}
                options={providerAccounts.map((a) => ({
                  value: a.id,
                  label: accountSelectLabel(a, providerById),
                }))}
              />
            </FormField>
            <FormField label="VPS (необязательно)" htmlFor="pay-vps">
              <SelectField
                triggerId="pay-vps"
                placeholder="Не привязан"
                value={watch('vpsId') || ''}
                onValueChange={(v) => setValue('vpsId', v ?? '')}
                options={[{ value: '', label: '—' }, ...vpsOptions]}
              />
            </FormField>
            <div className="grid grid-cols-3 gap-3">
              <FormField label="Дата" htmlFor="pay-date" error={errors.date?.message}>
                <Input id="pay-date" type="date" {...register('date')} />
              </FormField>
              <FormField label="Сумма" htmlFor="pay-amount" error={errors.amount?.message}>
                <Input id="pay-amount" type="number" step="0.01" {...register('amount')} />
              </FormField>
              <FormField label="Валюта" htmlFor="pay-cur" error={errors.currency?.message}>
                <Input id="pay-cur" {...register('currency')} />
              </FormField>
            </div>
            <FormField label="Заметка" htmlFor="pay-note">
              <Textarea id="pay-note" {...register('note')} />
            </FormField>
          </>
        )
      }}
    </FormSheetRhf>
  )
}
