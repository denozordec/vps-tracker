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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@cfdm/ui/components/select'

import type { Settings } from '@/types/entities'
import { useState } from 'react'

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
                    <Select
                      value={draft.baseCurrency ?? 'RUB'}
                      onValueChange={(v) => setForm({ ...draft, baseCurrency: v ?? 'RUB' })}
                    >
                      <SelectTrigger id="set-cur">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CURRENCIES.map((c) => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
                    <Select
                      value={draft.autoConvert === false ? 'off' : 'on'}
                      onValueChange={(v) => setForm({ ...draft, autoConvert: (v ?? 'on') === 'on' })}
                    >
                      <SelectTrigger id="set-auto" className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="on">Включена</SelectItem>
                        <SelectItem value="off">Выключена</SelectItem>
                      </SelectContent>
                    </Select>
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
          </div>
        )}
      </QueryState>
    </PageShell>
  )
}
