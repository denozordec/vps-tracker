import { Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import {
  ChevronsUpDownIcon,
  LogOutIcon,
  MonitorIcon,
  MoonIcon,
  PaletteIcon,
  SettingsIcon,
  SunIcon,
  UsersIcon,
} from 'lucide-react'

import { cn } from '@cfdm/ui/lib/utils'
import {
  Avatar,
  AvatarFallback,
} from '@cfdm/ui/components/avatar'
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
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@cfdm/ui/components/sidebar'

import {
  can,
  clearToken,
  getClaims,
  isAuthEnabled,
  redirectToPortalLogin,
  resetPortalHandoff,
} from '@/lib/auth'

/** Sidebar footer account menu — ReUI app-shell-1 NavUser. @see https://reui.io/preview/base/app-shell-1 */

const THEMES = [
  {
    value: 'light',
    label: 'Светлая',
    icon: <SunIcon className="size-3.5" aria-hidden />,
  },
  {
    value: 'dark',
    label: 'Тёмная',
    icon: <MoonIcon className="size-3.5" aria-hidden />,
  },
  {
    value: 'system',
    label: 'Системная',
    icon: <MonitorIcon className="size-3.5" aria-hidden />,
  },
] as const

function ThemeSegmentedToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const currentTheme = mounted ? (theme ?? 'system') : 'system'

  return (
    <div
      role="radiogroup"
      aria-label="Тема"
      className="bg-muted/60 inline-flex items-center gap-0.5 rounded-full p-0.5"
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {THEMES.map(({ value, label, icon }) => {
        const isActive = currentTheme === value
        return (
          <Button
            key={value}
            type="button"
            role="radio"
            aria-checked={isActive}
            aria-label={label}
            variant="ghost"
            size="icon-xs"
            onClick={() => setTheme(value)}
            className={cn(
              'rounded-full',
              isActive
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {icon}
          </Button>
        )
      })}
    </div>
  )
}

function initials(name: string, email: string): string {
  const base = name.trim() || email.trim()
  if (!base) return '?'
  const parts = base.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase()
  }
  return base.slice(0, 2).toUpperCase()
}

export function NavUser() {
  const { isMobile } = useSidebar()
  const claims = getClaims()
  const authOn = isAuthEnabled()

  const name = claims?.name?.trim() || (authOn ? 'Пользователь' : 'Гость')
  const email = claims?.email?.trim() || (authOn ? '' : 'auth выключен')
  const fallback = initials(name, email)

  function handleSignOut() {
    clearToken()
    resetPortalHandoff()
    redirectToPortalLogin()
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                size="lg"
                className="data-popup-open:bg-sidebar-accent data-popup-open:text-sidebar-accent-foreground"
              />
            }
          >
            <Avatar className="size-8 rounded-lg">
              <AvatarFallback className="rounded-lg text-xs">
                {fallback}
              </AvatarFallback>
            </Avatar>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-semibold">{name}</span>
              <span className="truncate text-xs text-muted-foreground">
                {email || '—'}
              </span>
            </div>
            <ChevronsUpDownIcon className="ml-auto size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--anchor-width) min-w-56 rounded-lg"
            side={isMobile ? 'bottom' : 'right'}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel className="flex items-center gap-2 py-2 font-normal text-foreground">
                <Avatar className="size-8 rounded-lg">
                  <AvatarFallback className="rounded-lg text-xs">
                    {fallback}
                  </AvatarFallback>
                </Avatar>
                <div className="grid min-w-0 flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">{name}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {email || '—'}
                  </span>
                </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>

            <DropdownMenuSeparator />

            <DropdownMenuGroup>
              {can('vps:settings:admin') ? (
                <DropdownMenuItem
                  nativeButton={false}
                  render={<Link to="/spaces" />}
                >
                  <UsersIcon aria-hidden />
                  Пространство
                </DropdownMenuItem>
              ) : null}
              {can('vps:settings:admin') ? (
                <DropdownMenuItem
                  nativeButton={false}
                  render={<Link to="/settings" />}
                >
                  <SettingsIcon aria-hidden />
                  Настройки
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem className="cursor-default focus:bg-transparent">
                <PaletteIcon aria-hidden />
                Тема
                <div className="ml-auto">
                  <ThemeSegmentedToggle />
                </div>
              </DropdownMenuItem>
            </DropdownMenuGroup>

            {authOn ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem onClick={handleSignOut}>
                    <LogOutIcon aria-hidden />
                    Выйти
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
