import { FormSheetRhf } from '@/components/form-sheet-rhf'
import { FormField } from '@/components/form-field'
import { Input } from '@cfdm/ui/components/input'
import { Textarea } from '@cfdm/ui/components/textarea'
import { SelectField } from '@/components/select-field'
import type { ZodType } from 'zod'
import { balanceLedgerSchema, type BalanceLedgerFormValues } from '@/lib/schemas'
import type { LedgerDirection, Provider, ProviderAccount } from '@/types/entities'
import { accountSelectLabel, providerByIdMap } from '@/lib/billmanager'

const TODAY = new Date().toISOString().slice(0, 10)

const EMPTY: BalanceLedgerFormValues = {
  providerAccountId: '',
  direction: 'credit',
  amount: 0,
  currency: 'RUB',
  date: TODAY,
  note: '',
}

interface BalanceEntrySheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultValues: BalanceLedgerFormValues
  providerAccounts: ProviderAccount[]
  providers: Provider[]
  onSubmit: (values: BalanceLedgerFormValues) => void
  submitting?: boolean
}

export function balanceEntryFormDefaults(fallbackAccountId = ''): BalanceLedgerFormValues {
  return { ...EMPTY, providerAccountId: fallbackAccountId }
}

export function BalanceEntrySheet({
  open,
  onOpenChange,
  defaultValues,
  providerAccounts,
  providers,
  onSubmit,
  submitting,
}: BalanceEntrySheetProps) {
  const providerById = providerByIdMap(providers)

  return (
    <FormSheetRhf
      open={open}
      onOpenChange={onOpenChange}
      title="Новая запись"
      schema={balanceLedgerSchema as unknown as ZodType<BalanceLedgerFormValues>}
      defaultValues={defaultValues}
      onSubmit={onSubmit}
      submitting={submitting}
    >
      {(form) => {
        const { register, formState: { errors }, watch, setValue } = form
        return (
          <>
            <FormField label="Аккаунт" htmlFor="bl-acc" error={errors.providerAccountId?.message}>
              <SelectField
                triggerId="bl-acc"
                placeholder="Выберите аккаунт"
                value={watch('providerAccountId')}
                onValueChange={(v) => setValue('providerAccountId', v ?? '', { shouldValidate: true })}
                options={providerAccounts.map((a) => ({
                  value: a.id,
                  label: accountSelectLabel(a, providerById),
                }))}
              />
            </FormField>
            <FormField label="Движение" htmlFor="bl-dir">
              <SelectField
                triggerId="bl-dir"
                value={watch('direction')}
                onValueChange={(v) => setValue('direction', (v ?? 'credit') as LedgerDirection)}
                options={[
                  { value: 'credit', label: 'Приход' },
                  { value: 'debit', label: 'Списание' },
                ]}
              />
            </FormField>
            <div className="grid grid-cols-3 gap-3">
              <FormField label="Дата" htmlFor="bl-date" error={errors.date?.message}>
                <Input id="bl-date" type="date" {...register('date')} />
              </FormField>
              <FormField label="Сумма" htmlFor="bl-amount" error={errors.amount?.message}>
                <Input id="bl-amount" type="number" step="0.01" {...register('amount')} />
              </FormField>
              <FormField label="Валюта" htmlFor="bl-cur" error={errors.currency?.message}>
                <Input id="bl-cur" {...register('currency')} />
              </FormField>
            </div>
            <FormField label="Заметка" htmlFor="bl-note">
              <Textarea id="bl-note" {...register('note')} />
            </FormField>
          </>
        )
      }}
    </FormSheetRhf>
  )
}
