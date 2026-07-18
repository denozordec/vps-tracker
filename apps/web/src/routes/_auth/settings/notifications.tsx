import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { useMemo } from 'react'
import { z } from 'zod'

import { snapshotQueryOptions } from '@/queries/snapshot'
import { api, ApiError } from '@/lib/api-client'
import { QueryState } from '@/components/query-state'
import { EmptyState } from '@/components/empty-state'
import { StatusBadge } from '@/components/status-badge'
import { LoadingButton } from '@/components/loading-button'
import { SettingRow } from '@/components/setting-row'
import { SettingsCard } from '@/components/reui-kit/settings-card'
import {
  settingsToFormValues,
  useSettingsSave,
  useSettingsSnapshot,
} from '@/components/settings/use-settings-section'
import { FieldGroup } from '@cfdm/ui/components/field'
import { Input } from '@cfdm/ui/components/input'
import { Skeleton } from '@cfdm/ui/components/skeleton'
import { Switch } from '@cfdm/ui/components/switch'
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from '@cfdm/ui/components/item'
import type { NotificationLogRow } from '@/types/entities'

export const Route = createFileRoute('/_auth/settings/notifications')({
  loader: ({ context: { queryClient } }) =>
    queryClient.ensureQueryData(snapshotQueryOptions()),
  component: SettingsNotificationsPage,
})

const notifySchema = z.object({
  telegramChatId: z.string().optional().default(''),
  telegramBotToken: z.string().optional().default(''),
  telegramMessageThreadId: z.string().optional().default(''),
  notifyPaymentExpiryEnabled: z.boolean().default(true),
  notifyNewTariffsEnabled: z.boolean().default(true),
  notifyLowBalanceEnabled: z.boolean().default(true),
  notifySyncDigestEnabled: z.boolean().default(true),
  notifyVpsDownEnabled: z.boolean().default(true),
  notifyIntervalMinutes: z.coerce.number().min(15).default(60),
  uptimeCheckIntervalMinutes: z.coerce.number().min(1).default(5),
  webhookUrl: z.string().url('Невалидный URL').or(z.literal('')).optional().default(''),
  webhookEnabled: z.boolean().default(false),
})

type NotifyFormValues = z.infer<typeof notifySchema>

const NOTIFICATION_STATUS_MAP: Record<string, string> = {
  sent: 'ok',
  failed: 'error',
}

const NOTIFICATION_STATUS_LABELS: Record<string, string> = {
  sent: 'Отправлено',
  failed: 'Ошибка',
}

function SettingsNotificationsPage() {
  const { data: snapshot, current, isLoading, isError, error, refetch } =
    useSettingsSnapshot()
  const saveMut = useSettingsSave({ successMessage: 'Настройки уведомлений сохранены' })

  const formValues = current ? settingsToFormValues(current) : undefined

  const form = useForm<NotifyFormValues>({
    resolver: zodResolver(notifySchema),
    values: formValues
      ? {
          telegramChatId: formValues.telegramChatId ?? '',
          telegramBotToken: '',
          telegramMessageThreadId: formValues.telegramMessageThreadId ?? '',
          notifyPaymentExpiryEnabled: formValues.notifyPaymentExpiryEnabled ?? true,
          notifyNewTariffsEnabled: formValues.notifyNewTariffsEnabled ?? true,
          notifyLowBalanceEnabled: formValues.notifyLowBalanceEnabled ?? true,
          notifySyncDigestEnabled: formValues.notifySyncDigestEnabled ?? true,
          notifyVpsDownEnabled: formValues.notifyVpsDownEnabled ?? true,
          notifyIntervalMinutes: formValues.notifyIntervalMinutes ?? 60,
          uptimeCheckIntervalMinutes: formValues.uptimeCheckIntervalMinutes ?? 5,
          webhookUrl: formValues.webhookUrl ?? '',
          webhookEnabled: formValues.webhookEnabled ?? false,
        }
      : undefined,
  })

  const webhookEnabled = form.watch('webhookEnabled')

  const telegramTestMut = useMutation({
    mutationFn: () => {
      const values = form.getValues()
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
      return api.sendTelegramTest(payload)
    },
    onSuccess: (data) => {
      if (!data.ok) {
        toast.error(data.error ?? 'Ошибка Telegram', { duration: 10_000 })
        return
      }
      toast.success('Тестовое сообщение отправлено')
    },
    onError: (e: unknown) =>
      toast.error(e instanceof ApiError ? e.message : 'Ошибка отправки', { duration: 10_000 }),
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

  const { data: notificationLog = [] } = useQuery({
    queryKey: ['notifications', 'log'],
    queryFn: () => api.fetchNotificationLog(30),
  })

  const notificationRows = useMemo(
    () => notificationLog as NotificationLogRow[],
    [notificationLog],
  )

  return (
    <QueryState
      data={snapshot}
      isLoading={isLoading}
      isError={isError}
      error={error}
      onRetry={() => refetch()}
      skeleton={
        <div className="flex flex-col gap-4">
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      }
    >
      {() => (
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) =>
            void form.handleSubmit((values) => {
              saveMut.mutate(values, {
                onSuccess: () =>
                  form.reset({ ...values, telegramBotToken: '' }),
              })
            })(e)
          }
        >
          {/* preview https://reui.io/preview/base/settings-3 */}
          <SettingsCard
            title="Telegram"
            description="Уведомления о здоровье инвентаря"
            footer={
              <LoadingButton
                type="button"
                variant="outline"
                onClick={() => telegramTestMut.mutate()}
                loading={telegramTestMut.isPending}
              >
                Тест
              </LoadingButton>
            }
          >
            <FieldGroup className="gap-0">
              <SettingRow title="Chat ID" labelFor="set-tg-chat" compact>
                <Input
                  id="set-tg-chat"
                  className="w-full max-w-xs"
                  placeholder="-1001234567890"
                  {...form.register('telegramChatId')}
                />
              </SettingRow>
              <SettingRow title="Bot token" labelFor="set-tg-token" stacked>
                <Input
                  id="set-tg-token"
                  type="password"
                  autoComplete="new-password"
                  className="w-full"
                  placeholder={
                    current?.telegramBotTokenSet
                      ? 'Токен установлен — введите новый для замены'
                      : '123456:ABC-DEF...'
                  }
                  {...form.register('telegramBotToken')}
                />
              </SettingRow>
              <SettingRow
                title="Thread ID"
                description="Топик форума (необязательно)"
                labelFor="set-tg-thread"
                compact
                last
              >
                <Input
                  id="set-tg-thread"
                  className="w-full max-w-xs"
                  placeholder="Необязательно"
                  {...form.register('telegramMessageThreadId')}
                />
              </SettingRow>
            </FieldGroup>
          </SettingsCard>

          <SettingsCard title="Webhook" description="POST JSON при тех же событиях, что и Telegram">
            <FieldGroup className="gap-0">
              <SettingRow
                title="Webhook"
                description="Включить доставку событий на URL"
                last={!webhookEnabled}
              >
                <Controller
                  control={form.control}
                  name="webhookEnabled"
                  render={({ field }) => (
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      aria-label="Webhook"
                    />
                  )}
                />
              </SettingRow>
              {webhookEnabled ? (
                <SettingRow title="Webhook URL" labelFor="set-webhook-url" stacked last>
                  <div className="flex w-full flex-col gap-2">
                    <Input
                      id="set-webhook-url"
                      className="w-full"
                      placeholder="https://hooks.example.com/..."
                      aria-invalid={!!form.formState.errors.webhookUrl}
                      {...form.register('webhookUrl')}
                    />
                    <LoadingButton
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-fit"
                      onClick={() => webhookTestMut.mutate()}
                      loading={webhookTestMut.isPending}
                    >
                      Тест webhook
                    </LoadingButton>
                  </div>
                </SettingRow>
              ) : null}
            </FieldGroup>
          </SettingsCard>

          {/* preview https://reui.io/preview/base/settings-2 */}
          <SettingsCard
            title="События и интервалы"
            description="Какие уведомления отправлять и как часто проверять"
            footer={
              <LoadingButton
                type="submit"
                loading={saveMut.isPending}
                disabled={!form.formState.isDirty}
              >
                Сохранить
              </LoadingButton>
            }
          >
            <FieldGroup className="gap-0">
              <SettingRow
                title="Интервал проверки оплаты"
                description="Минимум 15 минут"
                labelFor="set-notify-int"
                compact
              >
                <Input
                  id="set-notify-int"
                  type="number"
                  min={15}
                  className="w-28"
                  {...form.register('notifyIntervalMinutes')}
                />
              </SettingRow>
              <SettingRow
                title="Интервал uptime"
                description="Минимум 1 минута"
                labelFor="set-uptime-int"
                compact
              >
                <Input
                  id="set-uptime-int"
                  type="number"
                  min={1}
                  className="w-28"
                  {...form.register('uptimeCheckIntervalMinutes')}
                />
              </SettingRow>
              <SettingRow title="Низкий баланс" description="Алерт при падении баланса аккаунта">
                <Controller
                  control={form.control}
                  name="notifyLowBalanceEnabled"
                  render={({ field }) => (
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      aria-label="Низкий баланс"
                    />
                  )}
                />
              </SettingRow>
              <SettingRow title="Дайджест синка" description="Итог автосинка BILLmanager">
                <Controller
                  control={form.control}
                  name="notifySyncDigestEnabled"
                  render={({ field }) => (
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      aria-label="Дайджест синка"
                    />
                  )}
                />
              </SettingRow>
              <SettingRow title="Истечение оплаты" description="VPS с приближающимся paid until">
                <Controller
                  control={form.control}
                  name="notifyPaymentExpiryEnabled"
                  render={({ field }) => (
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      aria-label="Истечение оплаты"
                    />
                  )}
                />
              </SettingRow>
              <SettingRow title="Новые тарифы" description="Появление тарифов в прайс-листе">
                <Controller
                  control={form.control}
                  name="notifyNewTariffsEnabled"
                  render={({ field }) => (
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      aria-label="Новые тарифы"
                    />
                  )}
                />
              </SettingRow>
              <SettingRow
                title="VPS недоступен"
                description="Uptime-проверка и failover"
                last
              >
                <Controller
                  control={form.control}
                  name="notifyVpsDownEnabled"
                  render={({ field }) => (
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      aria-label="VPS недоступен"
                    />
                  )}
                />
              </SettingRow>
            </FieldGroup>
          </SettingsCard>

          <SettingsCard
            title="Журнал уведомлений"
            description="Последние попытки доставки (Telegram и webhook)"
          >
            {notificationRows.length === 0 ? (
              <div className="px-5 py-6">
                <EmptyState title="Записей пока нет" />
              </div>
            ) : (
              <ItemGroup className="gap-0 px-2 py-1">
                {notificationRows.map((row) => {
                  const errorText =
                    row.status === 'failed' && row.payload?.error != null
                      ? String(row.payload.error)
                      : ''
                  return (
                    <Item key={row.id} className="border-0 px-3 py-2.5">
                      <ItemContent className="min-w-0 gap-1">
                        <ItemTitle className="w-full min-w-0 gap-2">
                          <span className="truncate">{row.event}</span>
                          <StatusBadge
                            status={NOTIFICATION_STATUS_MAP[row.status] ?? row.status}
                            label={NOTIFICATION_STATUS_LABELS[row.status] ?? row.status}
                          />
                        </ItemTitle>
                        <ItemDescription className="flex flex-wrap gap-x-3 gap-y-0.5">
                          <span>{new Date(row.createdAt).toLocaleString('ru-RU')}</span>
                          <span>{row.channel}</span>
                          {errorText ? (
                            <span className="text-destructive">{errorText}</span>
                          ) : null}
                        </ItemDescription>
                      </ItemContent>
                    </Item>
                  )
                })}
              </ItemGroup>
            )}
          </SettingsCard>
        </form>
      )}
    </QueryState>
  )
}
