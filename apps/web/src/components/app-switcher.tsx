import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@cfdm/ui/components/dropdown-menu'
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@cfdm/ui/components/sidebar'
import { CheckIcon, ChevronsUpDownIcon } from 'lucide-react'

import {
  APP_SWITCHER_ICONS,
  CURRENT_APP_ID,
  getCurrentApp,
} from '@/lib/app-switcher-config'
import { useAppSwitcherConfig } from '@/hooks/use-app-switcher'

export function AppSwitcher() {
  const { isMobile } = useSidebar()
  const { config, isLoading } = useAppSwitcherConfig()
  const current = getCurrentApp(config)
  const CurrentIcon = APP_SWITCHER_ICONS[current.icon]

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton size="lg" className="aria-expanded:bg-muted" />
            }
          >
            <div
              className="flex aspect-square size-8 items-center justify-center rounded-md bg-primary text-primary-foreground"
              aria-hidden
            >
              <CurrentIcon className="size-4" />
            </div>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-semibold">{current.name}</span>
              {current.subtitle ? (
                <span className="truncate text-xs text-muted-foreground">
                  {current.subtitle}
                </span>
              ) : null}
            </div>
            <ChevronsUpDownIcon className="ml-auto size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="min-w-56 rounded-lg"
            side={isMobile ? 'bottom' : 'right'}
            align="start"
            sideOffset={4}
          >
            <div className="px-2 py-1.5 text-xs text-muted-foreground">
              {isLoading ? 'Загрузка…' : config.menuLabel}
            </div>
            {config.apps.map((app) => {
              const Icon = APP_SWITCHER_ICONS[app.icon]
              const isCurrent = app.id === CURRENT_APP_ID

              if (isCurrent) {
                return (
                  <DropdownMenuItem key={app.id} disabled>
                    <Icon />
                    {app.name}
                    <CheckIcon className="ml-auto size-4" />
                  </DropdownMenuItem>
                )
              }

              return (
                <DropdownMenuItem
                  key={app.id}
                  nativeButton={false}
                  render={<a href={app.url} />}
                >
                  <Icon />
                  {app.name}
                  {app.shortcut ? (
                    <DropdownMenuShortcut>{app.shortcut}</DropdownMenuShortcut>
                  ) : null}
                </DropdownMenuItem>
              )
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
