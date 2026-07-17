import { Link } from '@tanstack/react-router'
import { LayoutGridIcon } from 'lucide-react'
import { Button } from '@cfdm/ui/components/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@cfdm/ui/components/dropdown-menu'
import {
  APP_SWITCHER_ICONS,
  CURRENT_APP_ID,
} from '@/lib/app-switcher-config'
import { useAppSwitcherConfig } from '@/hooks/use-app-switcher'

/** Header apps grid — app-shell-12 AppsMenu. @see https://reui.io/preview/base/app-shell-12 */
export function AppsMenu() {
  const { config, isLoading } = useAppSwitcherConfig()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon" aria-label="Приложения" />
        }
      >
        <LayoutGridIcon
          className="size-4.5 transition-colors"
          aria-hidden="true"
        />
      </DropdownMenuTrigger>

      <DropdownMenuContent
        side="bottom"
        align="end"
        sideOffset={8}
        className="w-72"
      >
        <DropdownMenuGroup>
          <DropdownMenuLabel>
            {isLoading ? 'Загрузка…' : config.menuLabel}
          </DropdownMenuLabel>
          <div className="grid grid-cols-3 gap-1 p-1">
            {config.apps.map((app) => {
              const Icon = APP_SWITCHER_ICONS[app.icon]
              const isCurrent = app.id === CURRENT_APP_ID

              if (isCurrent) {
                return (
                  <DropdownMenuItem
                    key={app.id}
                    disabled
                    className="h-auto flex-col gap-1.5 py-3 text-center [&_svg]:size-5"
                  >
                    <span className="text-muted-foreground">
                      <Icon aria-hidden="true" />
                    </span>
                    <span className="text-xs font-medium">{app.name}</span>
                  </DropdownMenuItem>
                )
              }

              return (
                <DropdownMenuItem
                  key={app.id}
                  nativeButton={false}
                  render={<a href={app.url} />}
                  className="h-auto flex-col gap-1.5 py-3 text-center [&_svg]:size-5"
                >
                  <span className="text-muted-foreground">
                    <Icon aria-hidden="true" />
                  </span>
                  <span className="text-xs font-medium">{app.name}</span>
                </DropdownMenuItem>
              )
            })}
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            nativeButton={false}
            render={<Link to="/settings/integrations" />}
            className="justify-center text-sm font-medium"
          >
            Настроить приложения
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
