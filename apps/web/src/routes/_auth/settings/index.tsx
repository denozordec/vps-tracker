import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { DownloadIcon, UploadIcon } from 'lucide-react'
import { useMemo, useCallback } from 'react'

import { snapshotQueryOptions } from '@/queries/snapshot'
import { api, ApiError } from '@/lib/api-client'
import { QueryState } from '@/components/query-state'
import { SectionCardsSkeleton } from '@/components/skeletons'
import { EmptyState } from '@/components/empty-state'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { StatusBadge } from '@/components/status-badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@cfdm/ui/components/table'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@cfdm/ui/components/card'
import { FieldGroup } from '@cfdm/ui/components/field'
import { Input } from '@cfdm/ui/components/input'
import { parseCustomFieldDefs } from '@cfdm/shared/contracts/custom-fields'
import { LoadingButton } from '@/components/loading-button'
import { SelectField } from '@/components/select-field'
import { FormField } from '@/components/form-field'
import { Button } from '@cfdm/ui/components/button'
import { Switch } from '@cfdm/ui/components/switch'
import { settingsSchema, type SettingsFormValues } from '@/lib/schemas'
import { CustomFieldsEditor } from '@/components/domain/custom-fields-editor'
import type { NotificationLogRow, Settings } from '@/types/entities'

export const Route = createFileRoute('/_auth/settings/')({
  loader: ({ context: { queryClient } }) =>
    queryClient.ensureQueryData(snapshotQueryOptions()),
  component: SettingsPage,
})

const CURRENCIES = ['RUB', 'USD', 'EUR', 'UAH', 'KZT']

const NOTIFICATION_STATUS_MAP: Record<string, string> = {
  sent: 'ok',
  failed: 'error',
}

const NOTIFICATION_STATUS_LABELS: Record<string, string> = {
  sent: 'Отправлено',
  failed: 'Ошибка',
}

function notificationStatusLabel(status: string): string {
  return NOTIFICATION_STATUS_LABELS[status] ?? status
}

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
    telegramBotToken: '',
    notifyPaymentExpiryEnabled: s.notifyPaymentExpiryEnabled !== false,
    notifyNewTariffsEnabled: s.notifyNewTariffsEnabled !== false,
    notifyLowBalanceEnabled: s.notifyLowBalanceEnabled !== false,
    notifySyncDigestEnabled: s.notifySyncDigestEnabled !== false,
    notifyVpsDownEnabled: s.notifyVpsDownEnabled !== false,
    notifyIntervalMinutes: s.notifyIntervalMinutes ?? 60,
    uptimeCheckIntervalMinutes: s.uptimeCheckIntervalMinutes ?? 5,
    webhookUrl: s.webhookUrl ?? '',
    webhookEnabled: s.webhookEnabled === true,
    customFields: parseCustomFieldDefs(s.customFields),
    telegramMessageThreadId: s.telegramMessageThreadId ?? '',
    showQuickActions: s.showQuickActions !== false,
  }
}

function buildSettingsSavePayload(r: SettingsFormValues): SettingsFormValues {
  const { telegramBotToken, ...rest } = r
  const token = telegramBotToken?.trim() ?? ''
  return token ? { ...rest, telegramBotToken: token } : (rest as SettingsFormValues)
}

function buildTelegramTestPayload(values: SettingsFormValues) {
  const token = values.telegramBotToken?.trim() ?? ''
  const payload: {
    telegramChatId?: string
    telegramMessageThreadId?: string
    telegramBotToken?: string
  } = {
    telegramChatId: values.telegramChatId?.trim() || undefined,
    telegramMessageThreadId: values.telegramMessageThreadId ?? '',
  }
  if (token) payload.telegramBotToken = token
  return payload
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
      const payload = buildSettingsSavePayload(patch)
      if (current?.id) return api.update<Settings>('settings', current.id, payload)
      return api.create<Settings>('settings', {
        id: 'settings-main',
        ratesUrl: 'https://www.cbr-xml-daily.ru/latest.js',
        ...payload,
      } as Settings)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['snapshot'] })
      void refetchLog()
      toast.success('Настройки сохранены')
      form.reset(form.getValues())
    },
    onError: (e: unknown) => toast.error(e instanceof ApiError ? e.message : 'Ошибка'),
  })

  const telegramTestMut = useMutation({
    mutationFn: () => api.sendTelegramTest(buildTelegramTestPayload(form.getValues())),
    onSuccess: (data) => {
      if (!data.ok) {
        toast.error(data.error ?? 'Ошибка Telegram', { duration: 10_000 })
        return
      }
      toast.success('Тестовое сообщение отправлено')
    },
    onError: (e: unknown) => toast.error(e instanceof ApiError ? e.message : 'Ошибка отправки', { duration: 10_000 }),
  })

  const webhookTestMut = useMutation({
    mutationFn: () => api.sendWebhookTest(),
    onSuccess: (data) => {
      if (!data.ok) {
        toast.error(data.error ?? 'Ошибка webhook')
        return
      }
      toast.success('Тестовый webhook отправлен')
    },
    onError: (e: unknown) => toast.error(e instanceof ApiError ? e.message : 'Ошибка отправки'),
  })

  const { data: notificationLog = [], refetch: refetchLog } = useQuery({
    queryKey: ['notifications', 'log'],
    queryFn: () => api.fetchNotificationLog(30),
  })

  const importJsonMut = useMutation({
    mutationFn: (text: string) => api.importBackupJson(JSON.parse(text)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['snapshot'] })
      toast.success('Импорт JSON выполнен')
    },
    onError: (e: unknown) => toast.error(e instanceof ApiError ? e.message : 'Ошибка импорта'),
  })

  const importDbMut = useMutation({
    mutationFn: (buffer: ArrayBuffer) => api.importBackupDatabase(buffer),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['snapshot'] })
      toast.success('Импорт SQLite выполнен')
    },
    onError: (e: unknown) => toast.error(e instanceof ApiError ? e.message : 'Ошибка импорта'),
  })

  const pickJsonFile = useCallback(() => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'application/json,.json'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      const text = await file.text()
      importJsonMut.mutate(text)
    }
    input.click()
  }, [importJsonMut])

  const pickDbFile = useCallback(() => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.db,application/octet-stream'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      const buffer = await file.arrayBuffer()
      importDbMut.mutate(buffer)
    }
    input.click()
  }, [importDbMut])

  const notificationRows = useMemo(
    () => notificationLog as NotificationLogRow[],
    [notificationLog],
  )

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
      <ConfirmDialog
        title="Импортировать JSON?"
        description="Текущие данные будут перезаписаны содержимым файла резервной копии."
        confirmLabel="Выбрать файл"
        destructive
        onConfirm={pickJsonFile}
        trigger={
          <LoadingButton
            type="button"
            variant="outline"
            loading={importJsonMut.isPending}
          >
            <UploadIcon data-icon="inline-start" />
            Импорт JSON
          </LoadingButton>
        }
      />
      <ConfirmDialog
        title="Импортировать SQLite?"
        description="Текущая база данных будет полностью заменена загруженным файлом .db."
        confirmLabel="Выбрать файл"
        destructive
        onConfirm={pickDbFile}
        trigger={
          <LoadingButton
            type="button"
            variant="outline"
            loading={importDbMut.isPending}
          >
            <UploadIcon data-icon="inline-start" />
            Импорт SQLite
          </LoadingButton>
        }
      />
    </div>
  )

  return (
    <>
      <div className="flex flex-wrap gap-2">{backupActions}</div>
      <QueryState
        data={snapshot}
        isLoading={isLoading}
        isError={isError}
        error={error}
        onRetry={() => refetch()}
        skeleton={<SectionCardsSkeleton count={3} />}
      >
        {() => (
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => void form.handleSubmit((values) => upsertMut.mutate(values))(e)}
          >
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Интерфейс</CardTitle>
                  <CardDescription>Блоки на дашборде</CardDescription>
                </CardHeader>
                <CardContent>
                  <FieldGroup>
                    <FormField label="Быстрые действия" htmlFor="set-qa">
                      <Controller
                        control={form.control}
                        name="showQuickActions"
                        render={({ field }) => (
                          <div className="flex items-center gap-3">
                            <Switch
                              id="set-qa"
                              checked={field.value !== false}
                              onCheckedChange={field.onChange}
                            />
                            <span className="text-muted-foreground text-sm">
                              Показывать на дашборде
                            </span>
                          </div>
                        )}
                      />
                    </FormField>
                  </FieldGroup>
                </CardContent>
              </Card>
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
                        autoComplete="new-password"
                        placeholder={
                          current?.telegramBotTokenSet ? 'Токен установлен — введите новый для замены' : '123456:ABC-DEF...'
                        }
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
                  </FieldGroup>
                </CardContent>
              </Card>

              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle>Уведомления</CardTitle>
                  <CardDescription>События, интервалы и каналы доставки</CardDescription>
                </CardHeader>
                <CardContent>
                  <FieldGroup>
                    <FormField label="Интервал проверки оплаты (мин)" htmlFor="set-notify-int">
                      <Input id="set-notify-int" type="number" min={15} {...form.register('notifyIntervalMinutes')} />
                    </FormField>
                    <FormField label="Интервал uptime-проверки (мин)" htmlFor="set-uptime-int">
                      <Input
                        id="set-uptime-int"
                        type="number"
                        min={1}
                        {...form.register('uptimeCheckIntervalMinutes')}
                      />
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
                    <LoadingButton
                      type="button"
                      variant="outline"
                      onClick={() => webhookTestMut.mutate()}
                      loading={webhookTestMut.isPending}
                    >
                      Тест webhook
                    </LoadingButton>
                  </FieldGroup>
                </CardContent>
              </Card>

              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle>Журнал уведомлений</CardTitle>
                  <CardDescription>Последние попытки доставки (Telegram и webhook)</CardDescription>
                </CardHeader>
                <CardContent>
                  {notificationRows.length === 0 ? (
                    <EmptyState title="Записей пока нет" />
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Время</TableHead>
                          <TableHead>Событие</TableHead>
                          <TableHead>Канал</TableHead>
                          <TableHead>Статус</TableHead>
                          <TableHead>Ошибка</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {notificationRows.map((row) => {
                          const errorText =
                            row.status === 'failed' && row.payload?.error != null
                              ? String(row.payload.error)
                              : ''
                          return (
                            <TableRow key={row.id}>
                              <TableCell className="whitespace-nowrap text-muted-foreground">
                                {new Date(row.createdAt).toLocaleString('ru-RU')}
                              </TableCell>
                              <TableCell>{row.event}</TableCell>
                              <TableCell>{row.channel}</TableCell>
                              <TableCell>
                                <StatusBadge
                                  status={NOTIFICATION_STATUS_MAP[row.status] ?? row.status}
                                  label={notificationStatusLabel(row.status)}
                                />
                              </TableCell>
                              <TableCell className="max-w-xs break-words text-xs text-destructive">
                                {errorText || '—'}
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>

              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle>Кастомные поля VPS</CardTitle>
                  <CardDescription>
                    Поля отображаются в таблице VPS и в форме редактирования сервера
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <CustomFieldsEditor
                    control={form.control}
                    setValue={form.setValue}
                    errors={form.formState.errors.customFields}
                  />
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
    </>
  )
}
