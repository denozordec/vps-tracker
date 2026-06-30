import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { snapshotQueryOptions } from '@/queries/snapshot'
import { appSwitcherQueryKey } from '@/queries/app-switcher'
import { api } from '@/lib/api-client'
import { QueryState } from '@/components/query-state'
import { SectionCardsSkeleton } from '@/components/skeletons'
import { AppSwitcherEditor } from '@/components/integrations/app-switcher-editor'
import { CfdmIntegrationCard } from '@/components/integrations/cfdm-integration-card'
import type { Settings } from '@/types/entities'
import { DEFAULT_APP_SWITCHER_CONFIG } from '@/lib/app-switcher-config'

export const Route = createFileRoute('/_auth/settings/integrations')({
  component: SettingsIntegrationsPage,
})

function SettingsIntegrationsPage() {
  const queryClient = useQueryClient()
  const { data: snapshot, isLoading, isError, error, refetch } = useQuery(snapshotQueryOptions())
  const current = snapshot?.settings?.[0] as Settings | undefined

  const saveMut = useMutation({
    mutationFn: (patch: Partial<Settings> & { appSwitcher?: Settings['appSwitcher'] }) =>
      api.update<Settings>('settings', current?.id ?? 'settings-main', patch),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: snapshotQueryOptions().queryKey })
      await queryClient.invalidateQueries({ queryKey: appSwitcherQueryKey })
      toast.success('Настройки интеграции сохранены')
    },
    onError: () => toast.error('Не удалось сохранить'),
  })

  return (
    <QueryState
      data={snapshot}
      isLoading={isLoading}
      isError={isError}
      error={error}
      onRetry={() => refetch()}
      skeleton={<SectionCardsSkeleton count={2} />}
    >
      {() => (
        <div className="flex flex-col gap-4">
          <AppSwitcherEditor
            defaultValues={current?.appSwitcher ?? DEFAULT_APP_SWITCHER_CONFIG}
            isSaving={saveMut.isPending}
            onSave={(appSwitcher) => saveMut.mutate({ appSwitcher })}
          />
          <CfdmIntegrationCard
            settings={current}
            isSaving={saveMut.isPending}
            onSave={(patch) => saveMut.mutate(patch)}
          />
        </div>
      )}
    </QueryState>
  )
}
