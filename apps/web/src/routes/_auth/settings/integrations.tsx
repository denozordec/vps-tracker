import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ExternalLinkIcon } from 'lucide-react'
import { toast } from 'sonner'

import { snapshotQueryOptions } from '@/queries/snapshot'
import { api } from '@/lib/api-client'
import { authPortalUrl, isAuthEnabled } from '@/lib/auth'
import { QueryState } from '@/components/query-state'
import { SectionCardsSkeleton } from '@/components/skeletons'
import { CfdmIntegrationCard } from '@/components/integrations/cfdm-integration-card'
import type { Settings } from '@/types/entities'
import { useAppSwitcherConfig } from '@/hooks/use-app-switcher'
import { Button } from '@cfdm/ui/components/button'
import {
  Frame,
  FrameDescription,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from '@/components/reui/frame'

export const Route = createFileRoute('/_auth/settings/integrations')({
  component: SettingsIntegrationsPage,
})

function SettingsIntegrationsPage() {
  const queryClient = useQueryClient()
  const { data: snapshot, isLoading, isError, error, refetch } = useQuery(snapshotQueryOptions())
  const current = snapshot?.settings?.[0] as Settings | undefined
  const { config: appSwitcher } = useAppSwitcherConfig()
  const portalAppsUrl = `${authPortalUrl().replace(/\/$/, '')}/admin/apps`

  const saveMut = useMutation({
    mutationFn: (patch: Partial<Settings>) =>
      api.update<Settings>('settings', current?.id ?? 'settings-main', patch),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: snapshotQueryOptions().queryKey })
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
          <Frame>
            <FrameHeader>
              <FrameTitle>App Switcher</FrameTitle>
              <FrameDescription>
                {appSwitcher.apps.length} приложений · меню «{appSwitcher.menuLabel}». Ссылки
                настраиваются на auth-portal.
              </FrameDescription>
            </FrameHeader>
            <FramePanel className="flex flex-col gap-3">
              <p className="text-muted-foreground text-sm">
                Локальный редактор отключён. Source of truth — портал.
              </p>
              {isAuthEnabled() ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-fit"
                  render={<a href={portalAppsUrl} />}
                >
                  Открыть на портале
                  <ExternalLinkIcon data-icon="inline-end" aria-hidden="true" />
                </Button>
              ) : null}
            </FramePanel>
          </Frame>
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
