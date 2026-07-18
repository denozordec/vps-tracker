import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { DownloadIcon, UploadIcon } from 'lucide-react'
import { useCallback } from 'react'
import { snapshotQueryOptions } from '@/queries/snapshot'
import { api, ApiError } from '@/lib/api-client'
import { QueryState } from '@/components/query-state'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { LoadingButton } from '@/components/loading-button'
import { SelectField } from '@/components/select-field'
import { SettingRow } from '@/components/setting-row'
import { SettingsCard } from '@/components/reui-kit/settings-card'
import {
  settingsToFormValues,
  useSettingsPatch,
  useSettingsSave,
  useSettingsSnapshot,
} from '@/components/settings/use-settings-section'
import { CustomFieldsEditor } from '@/components/domain/custom-fields-editor'
import { settingsSchema, type SettingsFormValues } from '@/lib/schemas'
import { Button } from '@cfdm/ui/components/button'
import { FieldGroup } from '@cfdm/ui/components/field'
import { Input } from '@cfdm/ui/components/input'
import { Skeleton } from '@cfdm/ui/components/skeleton'
import { Switch } from '@cfdm/ui/components/switch'

export const Route = createFileRoute('/_auth/settings/')({
  loader: ({ context: { queryClient } }) =>
    queryClient.ensureQueryData(snapshotQueryOptions()),
  component: SettingsGeneralPage,
})

const CURRENCIES = ['RUB', 'USD', 'EUR', 'UAH', 'KZT']

function SettingsSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-28 w-full rounded-xl" />
      <Skeleton className="h-48 w-full rounded-xl" />
      <Skeleton className="h-40 w-full rounded-xl" />
    </div>
  )
}

function SettingsGeneralPage() {
  const queryClient = useQueryClient()
  const { data: snapshot, current, isLoading, isError, error, refetch } =
    useSettingsSnapshot()
  const patchMut = useSettingsPatch({ successMessage: 'Настройки интерфейса сохранены' })
  const saveMut = useSettingsSave()

  const formValues = current ? settingsToFormValues(current) : undefined

  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    values: formValues,
  })

  const importJsonMut = useMutation({
    mutationFn: (text: string) => api.importBackupJson(JSON.parse(text)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: snapshotQueryOptions().queryKey })
      toast.success('Импорт JSON выполнен')
    },
    onError: (e: unknown) => toast.error(e instanceof ApiError ? e.message : 'Ошибка импорта'),
  })

  const importDbMut = useMutation({
    mutationFn: (buffer: ArrayBuffer) => api.importBackupDatabase(buffer),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: snapshotQueryOptions().queryKey })
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
      importJsonMut.mutate(await file.text())
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
      importDbMut.mutate(await file.arrayBuffer())
    }
    input.click()
  }, [importDbMut])

  const showQuickActions = current?.showQuickActions !== false

  return (
    <QueryState
      data={snapshot}
      isLoading={isLoading}
      isError={isError}
      error={error}
      onRetry={() => refetch()}
      skeleton={<SettingsSkeleton />}
    >
      {() => (
        <div className="flex flex-col gap-4">
          {/* preview https://reui.io/preview/base/settings-2 */}
          <SettingsCard title="Интерфейс" description="Блоки на панели управления">
            <FieldGroup className="gap-0">
              <SettingRow
                title="Быстрые действия"
                description="KPI-like плитки быстрых переходов под метриками на главной."
                last
              >
                <Switch
                  checked={showQuickActions}
                  disabled={isLoading || patchMut.isPending}
                  onCheckedChange={(checked) =>
                    patchMut.mutate({ showQuickActions: checked })
                  }
                  aria-label="Показывать быстрые действия"
                />
              </SettingRow>
            </FieldGroup>
          </SettingsCard>

          <form
            className="flex flex-col gap-4"
            onSubmit={(e) =>
              void form.handleSubmit((values) => {
                saveMut.mutate(
                  {
                    baseCurrency: values.baseCurrency,
                    ratesUrl: values.ratesUrl,
                    autoConvert: values.autoConvert,
                    customFields: values.customFields,
                  },
                  { onSuccess: () => form.reset(values) },
                )
              })(e)
            }
          >
            {/* preview https://reui.io/preview/base/settings-3 */}
            <SettingsCard
              title="Валюта и курсы"
              description="Отображение сумм и источник курсов"
            >
              <FieldGroup className="gap-0">
                <SettingRow
                  title="Базовая валюта"
                  description="Валюта для отображения сумм"
                  labelFor="set-cur"
                  compact
                >
                  <Controller
                    control={form.control}
                    name="baseCurrency"
                    render={({ field }) => (
                      <SelectField
                        triggerId="set-cur"
                        triggerClassName="w-32"
                        value={field.value}
                        onValueChange={(v) => field.onChange(v ?? 'RUB')}
                        options={CURRENCIES.map((c) => ({ value: c, label: c }))}
                      />
                    )}
                  />
                </SettingRow>
                <SettingRow
                  title="URL курсов"
                  description="JSON-источник курсов валют"
                  labelFor="set-rates"
                  stacked
                >
                  <Input
                    id="set-rates"
                    className="w-full"
                    placeholder="https://www.cbr-xml-daily.ru/latest.js"
                    aria-invalid={!!form.formState.errors.ratesUrl}
                    {...form.register('ratesUrl')}
                  />
                </SettingRow>
                <SettingRow
                  title="Автоконвертация"
                  description="Пересчитывать суммы в базовую валюту"
                  last
                >
                  <Controller
                    control={form.control}
                    name="autoConvert"
                    render={({ field }) => (
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        aria-label="Автоконвертация"
                      />
                    )}
                  />
                </SettingRow>
              </FieldGroup>
            </SettingsCard>

            <SettingsCard
              title="Кастомные поля VPS"
              description="Поля отображаются в таблице VPS и в форме редактирования сервера"
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
              <div className="px-5 py-4">
                <CustomFieldsEditor
                  control={form.control}
                  setValue={form.setValue}
                  errors={form.formState.errors.customFields}
                />
              </div>
            </SettingsCard>
          </form>

          <SettingsCard
            title="Резервные копии"
            description="Экспорт и импорт данных приложения"
          >
            <div className="flex flex-wrap gap-2 px-5 py-4">
              <Button
                type="button"
                variant="outline"
                size="sm"
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
                type="button"
                variant="outline"
                size="sm"
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
                    size="sm"
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
                    size="sm"
                    loading={importDbMut.isPending}
                  >
                    <UploadIcon data-icon="inline-start" />
                    Импорт SQLite
                  </LoadingButton>
                }
              />
            </div>
          </SettingsCard>
        </div>
      )}
    </QueryState>
  )
}
