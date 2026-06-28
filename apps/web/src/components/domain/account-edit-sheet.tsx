import { useMutation } from '@tanstack/react-query'
import { PlugIcon, RefreshCwIcon } from 'lucide-react'
import { toast } from 'sonner'
import { buildApiCredentials } from '@cfdm/shared/utils/api-credentials'

import { FormSheetRhf } from '@/components/form-sheet-rhf'
import { FormField } from '@/components/form-field'
import { Input } from '@cfdm/ui/components/input'
import { Textarea } from '@cfdm/ui/components/textarea'
import { SelectField } from '@/components/select-field'
import { LoadingButton } from '@/components/loading-button'
import type { ZodType } from 'zod'
import { providerAccountSchema, type ProviderAccountFormValues } from '@/lib/schemas'
import type { BillingMode, Provider } from '@/types/entities'
import { billingModeLabel } from '@/lib/format'
import { api, ApiError } from '@/lib/api-client'

const EMPTY: ProviderAccountFormValues = {
  providerId: '',
  name: '',
  apiLogin: '',
  apiPassword: '',
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
  onBalanceRefreshed?: () => void
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
  onBalanceRefreshed,
}: ProviderAccountEditSheetProps) {
  const isEdit = Boolean(defaultValues.id)

  const testMut = useMutation({
    mutationFn: async (values: { apiBaseUrl: string; apiCredentials: string }) =>
      api.testConnection(values.apiBaseUrl, values.apiCredentials),
    onSuccess: () => toast.success('Подключение успешно'),
    onError: (e: unknown) => toast.error(e instanceof ApiError ? e.message : 'Ошибка подключения'),
  })

  const balanceMut = useMutation({
    mutationFn: (accountId: string) => api.fetchAccountBalance(accountId),
    onSuccess: (data) => {
      toast.success(`Баланс: ${data.balance} ${data.currency}`)
      onBalanceRefreshed?.()
    },
    onError: (e: unknown) => toast.error(e instanceof ApiError ? e.message : 'Ошибка обновления баланса'),
  })

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
        const providerId = watch('providerId')
        const provider = providers.find((p) => p.id === providerId)
        const apiBaseUrl = (provider?.apiBaseUrl ?? '').trim()
        const apiLogin = watch('apiLogin')?.trim() ?? ''
        const apiPassword = watch('apiPassword')?.trim() ?? ''
        const apiCredentials = buildApiCredentials(apiLogin, apiPassword)
        const canTest = Boolean(apiBaseUrl && apiCredentials)

        return (
          <>
            <FormField label="Хостер" htmlFor="acc-provider" error={errors.providerId?.message}>
              <SelectField
                triggerId="acc-provider"
                placeholder="Выберите хостера"
                value={providerId}
                onValueChange={(v) => setValue('providerId', v ?? '', { shouldValidate: true })}
                options={providers.map((p) => ({ value: p.id, label: p.name }))}
              />
            </FormField>
            <FormField label="Название" htmlFor="acc-name" error={errors.name?.message} invalid={!!errors.name}>
              <Input id="acc-name" aria-invalid={!!errors.name} {...register('name')} />
            </FormField>
            <FormField label="Логин API" htmlFor="acc-login">
              <Input id="acc-login" autoComplete="off" {...register('apiLogin')} />
            </FormField>
            <FormField
              label={isEdit ? 'Пароль API (необязательно)' : 'Пароль API'}
              htmlFor="acc-password"
              description={isEdit ? 'Оставьте пустым, чтобы сохранить существующий пароль' : undefined}
            >
              <Input id="acc-password" type="password" autoComplete="new-password" {...register('apiPassword')} />
            </FormField>
            <div className="flex flex-wrap gap-2">
              <LoadingButton
                type="button"
                variant="outline"
                size="sm"
                disabled={!canTest}
                loading={testMut.isPending}
                onClick={() => testMut.mutate({ apiBaseUrl, apiCredentials })}
              >
                <PlugIcon data-icon="inline-start" />
                Проверить подключение
              </LoadingButton>
              {isEdit && defaultValues.id ? (
                <LoadingButton
                  type="button"
                  variant="outline"
                  size="sm"
                  loading={balanceMut.isPending}
                  onClick={() => balanceMut.mutate(defaultValues.id!)}
                >
                  <RefreshCwIcon data-icon="inline-start" />
                  Обновить баланс
                </LoadingButton>
              ) : null}
            </div>
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
