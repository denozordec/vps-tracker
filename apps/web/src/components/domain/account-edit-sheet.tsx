import { FormSheetRhf } from '@/components/form-sheet-rhf'
import { FormField } from '@/components/form-field'
import { Input } from '@cfdm/ui/components/input'
import { Textarea } from '@cfdm/ui/components/textarea'
import { SelectField } from '@/components/select-field'
import type { ZodType } from 'zod'
import { providerAccountSchema, type ProviderAccountFormValues } from '@/lib/schemas'
import type { BillingMode, Provider } from '@/types/entities'
import { billingModeLabel } from '@/lib/format'

const EMPTY: ProviderAccountFormValues = {
  providerId: '',
  name: '',
  login: '',
  apiCredentials: '',
  billingMode: 'monthly',
  balanceAlertBelow: '',
  notes: '',
}

interface ProviderAccountEditSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultValues: ProviderAccountFormValues
  providers: Provider[]
  onSubmit: (values: ProviderAccountFormValues) => void
  submitting?: boolean
}

export function providerAccountFormDefaults(
  edit?: Partial<ProviderAccountFormValues> | null,
  fallbackProviderId = '',
): ProviderAccountFormValues {
  if (!edit) {
    return { ...EMPTY, providerId: fallbackProviderId }
  }
  return {
    ...EMPTY,
    ...edit,
    balanceAlertBelow: edit.balanceAlertBelow ?? '',
  }
}

export function ProviderAccountEditSheet({
  open,
  onOpenChange,
  defaultValues,
  providers,
  onSubmit,
  submitting,
}: ProviderAccountEditSheetProps) {
  const isEdit = Boolean(defaultValues.id)

  return (
    <FormSheetRhf
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? 'Редактировать аккаунт' : 'Новый аккаунт'}
      description="API-креды хранятся на сервере и используются для синка с BILLmanager"
      schema={providerAccountSchema as unknown as ZodType<ProviderAccountFormValues>}
      defaultValues={defaultValues}
      onSubmit={onSubmit}
      submitting={submitting}
    >
      {(form) => {
        const { register, formState: { errors }, watch, setValue } = form
        return (
          <>
            <FormField label="Хостер" htmlFor="acc-provider" error={errors.providerId?.message}>
              <SelectField
                triggerId="acc-provider"
                placeholder="Выберите хостера"
                value={watch('providerId')}
                onValueChange={(v) => setValue('providerId', v ?? '', { shouldValidate: true })}
                options={providers.map((p) => ({ value: p.id, label: p.name }))}
              />
            </FormField>
            <FormField label="Название" htmlFor="acc-name" error={errors.name?.message} invalid={!!errors.name}>
              <Input id="acc-name" aria-invalid={!!errors.name} {...register('name')} />
            </FormField>
            <FormField label="Логин" htmlFor="acc-login">
              <Input id="acc-login" {...register('login')} />
            </FormField>
            <FormField
              label={isEdit ? 'Новый API-пароль (необязательно)' : 'API-пароль (логин:пароль)'}
              htmlFor="acc-creds"
              description="Оставьте пустым при редактировании, чтобы сохранить существующий"
            >
              <Input id="acc-creds" type="password" {...register('apiCredentials')} />
            </FormField>
            <FormField label="Режим биллинга" htmlFor="acc-mode">
              <SelectField
                triggerId="acc-mode"
                value={watch('billingMode')}
                onValueChange={(v) => setValue('billingMode', (v ?? 'monthly') as BillingMode)}
                options={[
                  { value: 'monthly', label: billingModeLabel('monthly') },
                  { value: 'daily', label: billingModeLabel('daily') },
                ]}
              />
            </FormField>
            <FormField label="Порог низкого баланса" htmlFor="acc-alert" description="Уведомление на дашборде, если баланс API ниже">
              <Input
                id="acc-alert"
                type="number"
                min={0}
                placeholder="Не задан"
                {...register('balanceAlertBelow')}
              />
            </FormField>
            <FormField label="Заметки" htmlFor="acc-notes">
              <Textarea id="acc-notes" {...register('notes')} />
            </FormField>
          </>
        )
      }}
    </FormSheetRhf>
  )
}
