import { createFileRoute } from '@tanstack/react-router'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import { snapshotQueryOptions } from '@/queries/snapshot'
import { QueryState } from '@/components/query-state'
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

export const Route = createFileRoute('/_auth/settings/sync')({
  loader: ({ context: { queryClient } }) =>
    queryClient.ensureQueryData(snapshotQueryOptions()),
  component: SettingsSyncPage,
})

const syncSchema = z.object({
  syncEnabled: z.boolean().default(true),
  syncIntervalMinutes: z.coerce.number().min(15).default(60),
  syncTariffsIntervalMinutes: z.coerce.number().min(60).default(1440),
})

type SyncFormValues = z.infer<typeof syncSchema>

function SettingsSyncPage() {
  const { data: snapshot, current, isLoading, isError, error, refetch } =
    useSettingsSnapshot()
  const saveMut = useSettingsSave({ successMessage: 'Настройки синхронизации сохранены' })

  const formValues = current ? settingsToFormValues(current) : undefined

  const form = useForm<SyncFormValues>({
    resolver: zodResolver(syncSchema),
    values: formValues
      ? {
          syncEnabled: formValues.syncEnabled ?? true,
          syncIntervalMinutes: formValues.syncIntervalMinutes ?? 60,
          syncTariffsIntervalMinutes: formValues.syncTariffsIntervalMinutes ?? 1440,
        }
      : undefined,
  })

  return (
    <QueryState
      data={snapshot}
      isLoading={isLoading}
      isError={isError}
      error={error}
      onRetry={() => refetch()}
      skeleton={<Skeleton className="h-56 w-full rounded-xl" />}
    >
      {() => (
        <form
          onSubmit={(e) =>
            void form.handleSubmit((values) => {
              saveMut.mutate(values, { onSuccess: () => form.reset(values) })
            })(e)
          }
        >
          {/* preview https://reui.io/preview/base/settings-3 */}
          <SettingsCard
            title="Синхронизация"
            description="Автосинк BILLmanager и интервалы"
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
                title="Автосинк"
                description="Периодическая синхронизация VPS и платежей из BILLmanager"
              >
                <Controller
                  control={form.control}
                  name="syncEnabled"
                  render={({ field }) => (
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      aria-label="Автосинк"
                    />
                  )}
                />
              </SettingRow>
              <SettingRow
                title="Интервал синка"
                description="Минимум 15 минут"
                labelFor="set-sync-int"
                compact
              >
                <Input
                  id="set-sync-int"
                  type="number"
                  min={15}
                  className="w-28"
                  {...form.register('syncIntervalMinutes')}
                />
              </SettingRow>
              <SettingRow
                title="Интервал тарифов"
                description="Минимум 60 минут"
                labelFor="set-tariff-int"
                compact
                last
              >
                <Input
                  id="set-tariff-int"
                  type="number"
                  min={60}
                  className="w-28"
                  {...form.register('syncTariffsIntervalMinutes')}
                />
              </SettingRow>
            </FieldGroup>
          </SettingsCard>
        </form>
      )}
    </QueryState>
  )
}
