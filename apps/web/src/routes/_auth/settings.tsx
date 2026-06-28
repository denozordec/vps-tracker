import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { DownloadIcon, UploadIcon } from 'lucide-react'

import { snapshotQueryOptions } from '@/queries/snapshot'
import { api, ApiError } from '@/lib/api-client'
import { PageShell } from '@/components/page-shell'
import { PageHeader } from '@/components/page-header'
import { QueryState } from '@/components/query-state'
import { SectionCardsSkeleton } from '@/components/skeletons'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@cfdm/ui/components/card'
import { FieldGroup } from '@cfdm/ui/components/field'
import { Input } from '@cfdm/ui/components/input'
import { Textarea } from '@cfdm/ui/components/textarea'
import { LoadingButton } from '@/components/loading-button'
import { SelectField } from '@/components/select-field'
import { FormField } from '@/components/form-field'
import { Button } from '@cfdm/ui/components/button'
import { settingsSchema, type SettingsFormValues } from '@/lib/schemas'
import type { Settings } from '@/types/entities'

export const Route = createFileRoute('/_auth/settings')({
  loader: ({ context: { queryClient } }) =>
    queryClient.ensureQueryData(snapshotQueryOptions()),
  component: SettingsPage,
})

const CURRENCIES = ['RUB', 'USD', 'EUR', 'UAH', 'KZT']

function settingsToFormValues(s: Settings): SettingsFormValues {
  return {
    id: s.id,
    baseCurrency: s.baseCurrency ?? 'RUB',
    ratesUrl: s.ratesUrl ?? '',
    autoConvert: s.autoConvert !== false,
    syncEnabled: s.syncEnabled !== false,
    syncIntervalMinutes: s.syncIntervalMinutes ?? 60,
    syncTariffsIntervalMinutes: s.syncTariffsIntervalMinutes ?? 1440,
    telegramChatId: s.telegramChatId ?? '',
    telegramBotToken: s.telegramBotToken ?? '',
    notifyPaymentExpiryEnabled: s.notifyPaymentExpiryEnabled !== false,
    notifyNewTariffsEnabled: s.notifyNewTariffsEnabled !== false,
    notifyLowBalanceEnabled: s.notifyLowBalanceEnabled !== false,
    notifySyncDigestEnabled: s.notifySyncDigestEnabled !== false,
    notifyVpsDownEnabled: (s as Settings & { notifyVpsDownEnabled?: boolean }).notifyVpsDownEnabled !== false,
    webhookUrl: (s as Settings & { webhookUrl?: string }).webhookUrl ?? '',
    webhookEnabled: (s as Settings & { webhookEnabled?: boolean }).webhookEnabled === true,
    customFieldsJson: JSON.stringify(
      (s as Settings & { customFields?: unknown[] }).customFields ?? [],
      null,
      2,
    ),
    telegramMessageThreadId: (s as Settings & { telegramMessageThreadId?: string }).telegramMessageThreadId ?? '',
  }
}

function BoolSelect({
  id,
  label,
  value,
  onChange,
}: {
  id: string
  label: string
  value: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <FormField label={label} htmlFor={id}>
      <SelectField
        triggerId={id}
        triggerClassName="w-32"
        value={value ? 'on' : 'off'}
        onValueChange={(v) => onChange((v ?? 'on') === 'on')}
        options={[
          { value: 'on', label: 'Вкл' },
          { value: 'off', label: 'Выкл' },
        ]}
      />
    </FormField>
  )
}

function SettingsPage() {
  const queryClient = useQueryClient()
  const { data: snapshot, isLoading, isError, error, refetch } = useQuery(snapshotQueryOptions())
  const current = snapshot?.settings?.[0]

  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    values: current ? settingsToFormValues(current) : undefined,
  })

  const upsertMut = useMutation({
    mutationFn: (patch: SettingsFormValues) => {
      const { customFieldsJson, ...rest } = patch
      let customFields: unknown[] = []
      try {
        const parsed = JSON.parse(customFieldsJson || '[]') as unknown
        if (Array.isArray(parsed)) customFields = parsed
      } catch {
        throw new ApiError('Невалидный JSON в кастомных полях')
      }
      const payload = { ...rest, customFields }
      if (current?.id) return api.update<Settings>('settings', current.id, payload)
      return api.create<Settings>('settings', {
        id: 'settings-main',
        ratesUrl: 'https://www.cbr-xml-daily.ru/latest.js',
        ...payload,
      } as Settings)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['snapshot'] })
      toast.success('Настройки сохранены')
      form.reset(form.getValues())
    },
    onError: (e: unknown) => toast.error(e instanceof ApiError ? e.message : 'Ошибка'),
  })

  const telegramTestMut = useMutation({
    mutationFn: () => api.sendTelegramTest(),
    onSuccess: () => toast.success('Тестовое сообщение отправлено'),
    onError: (e: unknown) => toast.error(e instanceof ApiError ? e.message : 'Ошибка отправки'),
  })

  const backupActions = (
    <div className="flex flex-wrap gap-2">
      <Button
        variant="outline"
        onClick={async () => {
          try {
            const blob = await api.downloadBackupJson()
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `vps-tracker-backup-${new Date().toISOString().slice(0, 10)}.json`
            a.click()
            URL.revokeObjectURL(url)
            toast.success('JSON выгружен')
          } catch (e) {
            toast.error(e instanceof ApiError ? e.message : 'Ошибка выгрузки')
          }
        }}
      >
        <DownloadIcon data-icon="inline-start" />
        JSON
      </Button>
      <Button
        variant="outline"
        onClick={async () => {
          try {
            const blob = await api.downloadBackupDatabase()
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `vps-tracker-${new Date().toISOString().slice(0, 10)}.db`
            a.click()
            URL.revokeObjectURL(url)
            toast.success('База выгружена')
          } catch (e) {
            toast.error(e instanceof ApiError ? e.message : 'Ошибка выгрузки')
          }
        }}
      >
        <DownloadIcon data-icon="inline-start" />
        SQLite
      </Button>
      <Button
        variant="outline"
        onClick={() => {
          const input = document.createElement('input')
          input.type = 'file'
          input.accept = 'application/json,.json'
          input.onchange = async () => {
            const file = input.files?.[0]
            if (!file) return
            try {
              const text = await file.text()
              await api.importBackupJson(JSON.parse(text))
              void queryClient.invalidateQueries({ queryKey: ['snapshot'] })
              toast.success('Импорт JSON выполнен')
            } catch (e) {
              toast.error(e instanceof ApiError ? e.message : 'Ошибка импорта')
            }
          }
          input.click()
        }}
      >
        <UploadIcon data-icon="inline-start" />
        Импорт JSON
      </Button>
      <Button
        variant="outline"
        onClick={() => {
          const input = document.createElement('input')
          input.type = 'file'
          input.accept = '.db,application/octet-stream'
          input.onchange = async () => {
            const file = input.files?.[0]
            if (!file) return
            try {
              const buffer = await file.arrayBuffer()
              await api.importBackupDatabase(buffer)
              void queryClient.invalidateQueries({ queryKey: ['snapshot'] })
              toast.success('Импорт SQLite выполнен')
            } catch (e) {
              toast.error(e instanceof ApiError ? e.message : 'Ошибка импорта')
            }
          }
          input.click()
        }}
      >
        <UploadIcon data-icon="inline-start" />
        Импорт SQLite
      </Button>
    </div>
  )

  return (
    <PageShell>
      <PageHeader
        title="Настройки"
        description="Базовая валюта, курсы, синк, Telegram"
        actions={backupActions}
      />
      <QueryState
        data={snapshot}
        isLoading={isLoading}
        isError={isError}
        error={error}
        onRetry={() => refetch()}
        skeleton={<SectionCardsSkeleton count={1} />}
      >
        {() => (
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => void form.handleSubmit((values) => upsertMut.mutate(values))(e)}
          >
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Валюта и курсы</CardTitle>
                  <CardDescription>Отображение сумм и источник курсов</CardDescription>
                </CardHeader>
                <CardContent>
                  <FieldGroup>
                    <FormField label="Базовая валюта" htmlFor="set-cur" error={form.formState.errors.baseCurrency?.message}>
                      <Controller
                        control={form.control}
                        name="baseCurrency"
                        render={({ field }) => (
                          <SelectField
                            triggerId="set-cur"
                            value={field.value}
                            onValueChange={(v) => field.onChange(v ?? 'RUB')}
                            options={CURRENCIES.map((c) => ({ value: c, label: c }))}
                          />
                        )}
                      />
                    </FormField>
                    <FormField label="URL курсов (JSON)" htmlFor="set-rates" error={form.formState.errors.ratesUrl?.message}>
                      <Input
                        id="set-rates"
                        placeholder="https://www.cbr-xml-daily.ru/latest.js"
                        {...form.register('ratesUrl')}
                      />
                    </FormField>
                    <Controller
                      control={form.control}
                      name="autoConvert"
                      render={({ field }) => (
                        <BoolSelect
                          id="set-auto"
                          label="Автоконвертация"
                          value={field.value}
                          onChange={field.onChange}
                        />
                      )}
                    />
                  </FieldGroup>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Telegram</CardTitle>
                  <CardDescription>Уведомления о здоровье инвентаря</CardDescription>
                </CardHeader>
                <CardContent>
                  <FieldGroup>
                    <FormField label="Chat ID" htmlFor="set-tg-chat">
                      <Input id="set-tg-chat" placeholder="-1001234567890" {...form.register('telegramChatId')} />
                    </FormField>
                    <FormField label="Bot token" htmlFor="set-tg-token">
                      <Input
                        id="set-tg-token"
                        type="password"
                        placeholder="123456:ABC-DEF..."
                        {...form.register('telegramBotToken')}
                      />
                    </FormField>
                    <FormField label="Thread ID (топик)" htmlFor="set-tg-thread">
                      <Input id="set-tg-thread" placeholder="Необязательно" {...form.register('telegramMessageThreadId')} />
                    </FormField>
                    <LoadingButton
                      type="button"
                      variant="outline"
                      onClick={() => telegramTestMut.mutate()}
                      loading={telegramTestMut.isPending}
                    >
                      Тест
                    </LoadingButton>
                  </FieldGroup>
                </CardContent>
              </Card>

              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle>Синхронизация</CardTitle>
                  <CardDescription>Автосинк BILLmanager и интервалы</CardDescription>
                </CardHeader>
                <CardContent>
                  <FieldGroup>
                    <Controller
                      control={form.control}
                      name="syncEnabled"
                      render={({ field }) => (
                        <BoolSelect id="set-sync" label="Автосинк" value={field.value ?? true} onChange={field.onChange} />
                      )}
                    />
                    <FormField label="Интервал синка (мин)" htmlFor="set-sync-int">
                      <Input id="set-sync-int" type="number" min={15} {...form.register('syncIntervalMinutes')} />
                    </FormField>
                    <FormField label="Интервал тарифов (мин)" htmlFor="set-tariff-int">
                      <Input id="set-tariff-int" type="number" min={60} {...form.register('syncTariffsIntervalMinutes')} />
                    </FormField>
                    <Controller
                      control={form.control}
                      name="notifyLowBalanceEnabled"
                      render={({ field }) => (
                        <BoolSelect id="set-notify-bal" label="Низкий баланс" value={field.value ?? true} onChange={field.onChange} />
                      )}
                    />
                    <Controller
                      control={form.control}
                      name="notifySyncDigestEnabled"
                      render={({ field }) => (
                        <BoolSelect id="set-notify-sync" label="Дайджест синка" value={field.value ?? true} onChange={field.onChange} />
                      )}
                    />
                    <Controller
                      control={form.control}
                      name="notifyPaymentExpiryEnabled"
                      render={({ field }) => (
                        <BoolSelect id="set-notify-pay" label="Истечение оплаты" value={field.value ?? true} onChange={field.onChange} />
                      )}
                    />
                    <Controller
                      control={form.control}
                      name="notifyNewTariffsEnabled"
                      render={({ field }) => (
                        <BoolSelect id="set-notify-tar" label="Новые тарифы" value={field.value ?? true} onChange={field.onChange} />
                      )}
                    />
                    <Controller
                      control={form.control}
                      name="notifyVpsDownEnabled"
                      render={({ field }) => (
                        <BoolSelect id="set-notify-down" label="VPS недоступен" value={field.value ?? true} onChange={field.onChange} />
                      )}
                    />
                  </FieldGroup>
                </CardContent>
              </Card>

              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle>Webhook</CardTitle>
                  <CardDescription>POST JSON при тех же событиях, что и Telegram</CardDescription>
                </CardHeader>
                <CardContent>
                  <FieldGroup>
                    <Controller
                      control={form.control}
                      name="webhookEnabled"
                      render={({ field }) => (
                        <BoolSelect id="set-webhook" label="Webhook" value={field.value ?? false} onChange={field.onChange} />
                      )}
                    />
                    <FormField label="Webhook URL" htmlFor="set-webhook-url" error={form.formState.errors.webhookUrl?.message}>
                      <Input id="set-webhook-url" placeholder="https://hooks.example.com/..." {...form.register('webhookUrl')} />
                    </FormField>
                  </FieldGroup>
                </CardContent>
              </Card>

              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle>Кастомные поля VPS</CardTitle>
                  <CardDescription>JSON-массив: {"{ \"key\", \"label\", \"type\": \"text|number|bool\" }"}</CardDescription>
                </CardHeader>
                <CardContent>
                  <FormField label="Схема полей" htmlFor="set-custom-fields" error={form.formState.errors.customFieldsJson?.message}>
                    <Textarea
                      id="set-custom-fields"
                      className="min-h-32 font-mono text-xs"
                      {...form.register('customFieldsJson')}
                    />
                  </FormField>
                </CardContent>
              </Card>
            </div>

            <LoadingButton
              type="submit"
              className="w-fit"
              loading={upsertMut.isPending}
              disabled={!form.formState.isDirty}
            >
              Сохранить настройки
            </LoadingButton>
          </form>
        )}
      </QueryState>
    </PageShell>
  )
}
