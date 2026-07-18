import { useState, type ReactNode } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ChevronDownIcon,
  ExternalLinkIcon,
  GlobeIcon,
  LayoutGridIcon,
} from 'lucide-react'
import { toast } from 'sonner'

import { snapshotQueryOptions } from '@/queries/snapshot'
import { api } from '@/lib/api-client'
import { authPortalUrl, isAuthEnabled } from '@/lib/auth'
import { QueryState } from '@/components/query-state'
import { CfdmIntegrationForm } from '@/components/integrations/cfdm-integration-card'
import { useAppSwitcherConfig } from '@/hooks/use-app-switcher'
import { useSettingsSnapshot } from '@/components/settings/use-settings-section'
import type { Settings } from '@/types/entities'
import { Badge } from '@/components/reui/badge'
import {
  Frame,
  FrameDescription,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from '@/components/reui/frame'
import { Button } from '@cfdm/ui/components/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@cfdm/ui/components/collapsible'
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from '@cfdm/ui/components/item'
import { Skeleton } from '@cfdm/ui/components/skeleton'
import { cn } from '@cfdm/ui/lib/utils'

export const Route = createFileRoute('/_auth/settings/integrations')({
  loader: ({ context: { queryClient } }) =>
    queryClient.ensureQueryData(snapshotQueryOptions()),
  component: SettingsIntegrationsPage,
})

type IntegrationStatus = 'connected' | 'available' | 'warning'

const STATUS_META: Record<
  IntegrationStatus,
  { label: string; variant: 'success' | 'secondary' | 'warning' }
> = {
  connected: { label: 'Подключено', variant: 'success' },
  available: { label: 'Доступно', variant: 'secondary' },
  warning: { label: 'Требует настройки', variant: 'warning' },
}

/** Integration row — preview https://reui.io/preview/base/settings-16 */
function IntegrationRow({
  id,
  name,
  description,
  logo,
  status,
  open,
  onOpenChange,
  children,
}: {
  id: string
  name: string
  description: string
  logo: ReactNode
  status: IntegrationStatus
  open: boolean
  onOpenChange: (open: boolean) => void
  children: ReactNode
}) {
  const meta = STATUS_META[status]

  return (
    <Collapsible open={open} onOpenChange={onOpenChange}>
      <Item className="items-center gap-3 border-0 px-3.5 py-3 sm:px-4">
        <ItemMedia variant="icon">{logo}</ItemMedia>

        <ItemContent className="min-w-0 gap-0">
          <ItemTitle className="w-full min-w-0 gap-2">
            <span className="truncate">{name}</span>
            <Badge variant={meta.variant}>{meta.label}</Badge>
          </ItemTitle>
          <ItemDescription className="line-clamp-1">{description}</ItemDescription>
        </ItemContent>

        <ItemActions className="ml-auto shrink-0 justify-end gap-2">
          <CollapsibleTrigger
            render={
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-controls={`${id}-panel`}
                aria-expanded={open}
              />
            }
          >
            Настроить
            <ChevronDownIcon
              aria-hidden="true"
              data-icon="inline-end"
              className={cn('transition-transform', open && 'rotate-180')}
            />
          </CollapsibleTrigger>
        </ItemActions>
      </Item>

      <CollapsibleContent id={`${id}-panel`}>
        <div className="border-border/60 border-t px-0 py-0">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  )
}

function SettingsIntegrationsPage() {
  const queryClient = useQueryClient()
  const [openAppSwitcher, setOpenAppSwitcher] = useState(true)
  const [openCfdm, setOpenCfdm] = useState(true)
  const { data: snapshot, current, isLoading, isError, error, refetch } =
    useSettingsSnapshot()
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

  const appSwitcherStatus: IntegrationStatus =
    appSwitcher.apps.length > 0 ? 'connected' : 'available'

  const cfdmStatus: IntegrationStatus = !current
    ? 'available'
    : current.integrationEnabled && current.integrationTokenSet
      ? 'connected'
      : current.cfdmApiUrl || current.integrationTokenSet
        ? 'warning'
        : 'available'

  return (
    <QueryState
      data={snapshot}
      isLoading={isLoading}
      isError={isError}
      error={error}
      onRetry={() => refetch()}
      skeleton={
        <div className="flex flex-col gap-4">
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
      }
    >
      {() => (
        <div className="flex w-full flex-col gap-5">
          <section className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <h2 className="text-sm font-semibold">Подключённые приложения</h2>
              <p className="text-muted-foreground text-sm">
                Переключение между сервисами в sidebar
              </p>
            </div>

            <Frame>
              <FrameHeader className="sr-only">
                <FrameTitle>App Switcher</FrameTitle>
                <FrameDescription>
                  Ссылки приложений настраиваются на auth-portal
                </FrameDescription>
              </FrameHeader>
              <FramePanel className="p-0!">
                <ItemGroup className="gap-0">
                  <IntegrationRow
                    id="app-switcher"
                    name="App Switcher"
                    description={`${appSwitcher.apps.length} приложений · меню «${appSwitcher.menuLabel}»`}
                    logo={<LayoutGridIcon aria-hidden="true" />}
                    status={appSwitcherStatus}
                    open={openAppSwitcher}
                    onOpenChange={setOpenAppSwitcher}
                  >
                    <div className="flex flex-col gap-3 px-3.5 py-4 sm:px-4">
                      <p className="text-muted-foreground text-sm">
                        Список и URL сервисов хранятся на auth-portal. Локальный редактор
                        отключён.
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
                      ) : (
                        <p className="text-muted-foreground text-xs">
                          Включите auth-portal, чтобы редактировать ссылки.
                        </p>
                      )}
                    </div>
                  </IntegrationRow>
                </ItemGroup>
              </FramePanel>
            </Frame>
          </section>

          <section className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <h2 className="text-sm font-semibold">Внешние интеграции</h2>
              <p className="text-muted-foreground text-sm">
                Синхронизация доменов и сервисов из CF Domain Manager
              </p>
            </div>

            <Frame>
              <FrameHeader className="sr-only">
                <FrameTitle>CF Domain Manager</FrameTitle>
                <FrameDescription>URL API и integration token</FrameDescription>
              </FrameHeader>
              <FramePanel className="p-0!">
                <ItemGroup className="gap-0">
                  <IntegrationRow
                    id="cfdm"
                    name="CF Domain Manager"
                    description={
                      current?.cfdmApiUrl
                        ? current.cfdmApiUrl
                        : 'Приём синхронизации доменов и сервисов'
                    }
                    logo={<GlobeIcon aria-hidden="true" />}
                    status={cfdmStatus}
                    open={openCfdm}
                    onOpenChange={setOpenCfdm}
                  >
                    <CfdmIntegrationForm
                      settings={current}
                      isSaving={saveMut.isPending}
                      onSave={(values) => saveMut.mutate(values)}
                    />
                  </IntegrationRow>
                </ItemGroup>
              </FramePanel>
            </Frame>
          </section>
        </div>
      )}
    </QueryState>
  )
}
