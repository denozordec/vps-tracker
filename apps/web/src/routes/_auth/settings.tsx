import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { snapshotQueryOptions } from '@/queries/snapshot'
import { api, ApiError } from '@/lib/api-client'
import { PageShell } from '@/components/page-shell'
import { PageHeader } from '@/components/page-header'
import { QueryState } from '@/components/query-state'
import { SectionCardsSkeleton } from '@/components/skeletons'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@cfdm/ui/components/card'
import { Field, FieldGroup, FieldLabel } from '@cfdm/ui/components/field'
import { Input } from '@cfdm/ui/components/input'
import { LoadingButton } from '@/components/loading-button'
import { SelectField } from '@/components/select-field'

import type { Settings } from '@/types/entities'
import { useState } from 'react'
import { Button } from '@cfdm/ui/components/button'
import { DownloadIcon, UploadIcon } from 'lucide-react'

function boolSelect(
  draft: Partial<Settings>,
  setForm: (v: Partial<Settings>) => void,
  key: keyof Settings,
  id: string,
  label: string,
) {
  const val = draft[key] === false ? 'off' : 'on'
  return (
    <Field orientation="horizontal">
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <SelectField
        triggerId={id}
        triggerClassName="w-32"
        value={val}
        onValueChange={(v) => setForm({ ...draft, [key]: (v ?? 'on') === 'on' })}
        options={[
          { value: 'on', label: 'Вкл' },
          { value: 'off', label: 'Выкл' },
        ]}
      />
    </Field>
  )
}

export const Route = createFileRoute('/_auth/settings')({
  loader: ({ context: { queryClient } }) =>
    queryClient.ensureQueryData(snapshotQueryOptions()),
  component: SettingsPage,
})

const CURRENCIES = ['RUB', 'USD', 'EUR', 'UAH', 'KZT']

function SettingsPage() {
  const queryClient = useQueryClient()
  const { data: snapshot, isLoading, isError, error, refetch } = useQuery(snapshotQueryOptions())
  const current = snapshot?.settings?.[0]
  const [form, setForm] = useState<Partial<Settings> | null>(null)
  const draft = form ?? current ?? {}

  const upsertMut = useMutation({
    mutationFn: (patch: Partial<Settings>) => {
      if (current?.id) return api.update<Settings>('settings', current.id, patch)
      return api.create<Settings>('settings', {
        id: 'settings-main',
        baseCurrency: 'RUB',
        ratesUrl: 'https://www.cbr-xml-daily.ru/latest.js',
        autoConvert: true,
        ...patch,
      } as Settings)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['snapshot'] })
      toast.success('Настройки сохранены')
      setForm(null)
    },
    onError: (e: unknown) => toast.error(e instanceof ApiError ? e.message : 'Ошибка'),
  })

  const telegramTestMut = useMutation({
    mutationFn: () => api.sendTelegramTest(),
    onSuccess: () => toast.success('Тестовое сообщение отправлено'),
    onError: (e: unknown) => toast.error(e instanceof ApiError ? e.message : 'Ошибка отправки'),
  })

  return (
    <PageShell>
      <PageHeader title="Настройки" description="Базовая валюта, курсы, синк, Telegram" />
      <QueryState
        data={snapshot}
        isLoading={isLoading}
        isError={isError}
        error={error}
        onRetry={() => refetch()}
        skeleton={<SectionCardsSkeleton count={1} />}
      >
        {() => (
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Валюта и курсы</CardTitle>
                <CardDescription>Отображение сумм и источник курсов</CardDescription>
              </CardHeader>
              <CardContent>
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="set-cur">Базовая валюта</FieldLabel>
                    <SelectField
                      triggerId="set-cur"
                      value={draft.baseCurrency ?? 'RUB'}
                      onValueChange={(v) => setForm({ ...draft, baseCurrency: v ?? 'RUB' })}
                      options={CURRENCIES.map((c) => ({ value: c, label: c }))}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="set-rates">URL курсов (JSON)</FieldLabel>
                    <Input
                      id="set-rates"
                      value={draft.ratesUrl ?? ''}
                      onChange={(e) => setForm({ ...draft, ratesUrl: e.target.value })}
                      placeholder="https://www.cbr-xml-daily.ru/latest.js"
                    />
                  </Field>
                  <Field orientation="horizontal">
                    <FieldLabel htmlFor="set-auto">Автоконвертация</FieldLabel>
                    <SelectField
                      triggerId="set-auto"
                      triggerClassName="w-32"
                      value={draft.autoConvert === false ? 'off' : 'on'}
                      onValueChange={(v) => setForm({ ...draft, autoConvert: (v ?? 'on') === 'on' })}
                      options={[
                        { value: 'on', label: 'Включена' },
                        { value: 'off', label: 'Выключена' },
                      ]}
                    />
                  </Field>
                  <LoadingButton
                    className="w-fit"
                    onClick={() => upsertMut.mutate(draft)}
                    loading={upsertMut.isPending}
                    disabled={!form}
                  >
                    Сохранить
                  </LoadingButton>
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
                  <Field>
                    <FieldLabel htmlFor="set-tg-chat">Chat ID</FieldLabel>
                    <Input
                      id="set-tg-chat"
                      value={draft.telegramChatId ?? ''}
                      onChange={(e) => setForm({ ...draft, telegramChatId: e.target.value })}
                      placeholder="-1001234567890"
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="set-tg-token">Bot token</FieldLabel>
                    <Input
                      id="set-tg-token"
                      type="password"
                      value={draft.telegramBotToken ?? ''}
                      onChange={(e) => setForm({ ...draft, telegramBotToken: e.target.value })}
                      placeholder="123456:ABC-DEF..."
                    />
                  </Field>
                  <div className="flex gap-2">
                    <LoadingButton onClick={() => upsertMut.mutate(draft)} loading={upsertMut.isPending} disabled={!form}>
                      Сохранить
                    </LoadingButton>
                    <LoadingButton variant="outline" onClick={() => telegramTestMut.mutate()} loading={telegramTestMut.isPending}>
                      Тест
                    </LoadingButton>
                  </div>
                </FieldGroup>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Синхронизация</CardTitle>
                <CardDescription>Автосинк BILLmanager и интервалы</CardDescription>
              </CardHeader>
              <CardContent>
                <FieldGroup>
                  {boolSelect(draft, (v) => setForm(v), 'syncEnabled', 'set-sync', 'Автосинк')}
                  <Field>
                    <FieldLabel htmlFor="set-sync-int">Интервал синка (мин)</FieldLabel>
                    <Input
                      id="set-sync-int"
                      type="number"
                      min={15}
                      value={draft.syncIntervalMinutes ?? 60}
                      onChange={(e) =>
                        setForm({ ...draft, syncIntervalMinutes: Number(e.target.value) || 60 })
                      }
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="set-tariff-int">Интервал тарифов (мин)</FieldLabel>
                    <Input
                      id="set-tariff-int"
                      type="number"
                      min={60}
                      value={draft.syncTariffsIntervalMinutes ?? 1440}
                      onChange={(e) =>
                        setForm({
                          ...draft,
                          syncTariffsIntervalMinutes: Number(e.target.value) || 1440,
                        })
                      }
                    />
                  </Field>
                  {boolSelect(draft, (v) => setForm(v), 'notifyLowBalanceEnabled', 'set-notify-bal', 'Низкий баланс')}
                  {boolSelect(draft, (v) => setForm(v), 'notifySyncDigestEnabled', 'set-notify-sync', 'Дайджест синка')}
                  {boolSelect(draft, (v) => setForm(v), 'notifyPaymentExpiryEnabled', 'set-notify-pay', 'Истечение оплаты')}
                  {boolSelect(draft, (v) => setForm(v), 'notifyNewTariffsEnabled', 'set-notify-tar', 'Новые тарифы')}
                  <LoadingButton
                    className="w-fit"
                    onClick={() => upsertMut.mutate(draft)}
                    loading={upsertMut.isPending}
                    disabled={!form}
                  >
                    Сохранить
                  </LoadingButton>
                </FieldGroup>
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Резервное копирование</CardTitle>
                <CardDescription>Экспорт и импорт базы данных</CardDescription>
              </CardHeader>
              <CardContent>
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
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </QueryState>
    </PageShell>
  )
}
