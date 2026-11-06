import {
  LayoutDashboard,
  Server,
  ServerCog,
  Building2,
  Wallet,
  CreditCard,
  Coins,
  ChartColumnBig,
  ChartBar,
  Settings,
  RefreshCwIcon,
  FolderKanbanIcon,
  HistoryIcon,
  UsersIcon,
  Network,
  ShieldAlert,
  Globe,
  ChevronDownIcon,
} from 'lucide-react'

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from '@cfdm/ui/components/sidebar'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@cfdm/ui/components/collapsible'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@cfdm/ui/components/breadcrumb'
import { TooltipProvider } from '@cfdm/ui/components/tooltip'

import { Link, useRouterState } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useState, type CSSProperties, type ReactNode } from 'react'

import { SystemMonitorPopover } from '@/components/layout/system-monitor-popover'
import { SpaceSwitcher } from '@/components/layout/space-switcher'
import { NavUser } from '@/components/layout/nav-user'
import { AppSwitcher } from '@/components/app-switcher'
import { GlobalSearch, useGlobalSearchHotkey } from '@/components/global-search'
import { dashboardStatsQueryOptions } from '@/queries/dashboard'
import {
  can,
  permissionForPath,
} from '@/lib/auth'
import { SpaceProvider, useSpaceId } from '@/lib/space'
import { SKIP_TO_CONTENT_CLASS } from '@/lib/ui-surface'
import { cn } from '@cfdm/ui/lib/utils'

interface NavItem {
  to: string
  label: string
  icon: typeof LayoutDashboard
  /** Problem dot (design `pdot`): destructive / warning. */
  dot?: { tone: 'destructive' | 'warning'; label: string }
}

interface NavGroup {
  label: string
  items: NavItem[]
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Обзор',
    items: [{ to: '/dashboard', label: 'Дашборд', icon: LayoutDashboard }],
  },
  {
    label: 'Инфраструктура',
    items: [
      { to: '/vps', label: 'VPS', icon: Server },
      { to: '/blocking', label: 'Статус блокировок', icon: ShieldAlert },
      { to: '/geo', label: 'GeoIP', icon: Globe },
      { to: '/topology', label: 'Схема', icon: Network },
      { to: '/tariffs', label: 'Активные тарифы', icon: ServerCog },
      { to: '/providers', label: 'Хостеры', icon: Building2 },
      { to: '/accounts', label: 'Аккаунты хостеров', icon: Wallet },
      { to: '/projects', label: 'Проекты', icon: FolderKanbanIcon },
    ],
  },
  {
    label: 'Финансы',
    items: [
      { to: '/payments', label: 'Платежи', icon: CreditCard },
      { to: '/balance', label: 'Баланс и списания', icon: Coins },
    ],
  },
  {
    label: 'Аналитика',
    items: [
      { to: '/reports', label: 'Отчёты', icon: ChartColumnBig },
      { to: '/resources', label: 'Ресурсы', icon: ChartBar },
      { to: '/renewals', label: 'Продления', icon: RefreshCwIcon },
    ],
  },
  {
    label: 'Система',
    items: [
      { to: '/spaces', label: 'Пространство', icon: UsersIcon },
      { to: '/sync-journal', label: 'Журнал синка', icon: HistoryIcon },
      { to: '/audit', label: 'Журнал изменений', icon: HistoryIcon },
      { to: '/settings', label: 'Настройки', icon: Settings },
    ],
  },
]

const ALL_NAV_ITEMS = NAV_GROUPS.flatMap((g) => g.items)

const ROUTE_LABELS: Record<string, string> = Object.fromEntries(
  ALL_NAV_ITEMS.map((i) => [i.to, i.label]),
)

const PARENT_ROUTE: Record<string, string> = {
  '/vps': '/dashboard',
  '/topology': '/dashboard',
  '/tariffs': '/dashboard',
  '/providers': '/dashboard',
  '/accounts': '/dashboard',
  '/projects': '/dashboard',
  '/payments': '/dashboard',
  '/balance': '/dashboard',
  '/reports': '/dashboard',
  '/resources': '/dashboard',
  '/renewals': '/dashboard',
  '/sync-journal': '/settings',
  '/audit': '/settings',
  '/spaces': '/settings',
}

/** Shared ops chrome — etalon EvoBGP. @see docs/ui-design-contract.md */
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const [searchOpen, setSearchOpen] = useState(false)
  useGlobalSearchHotkey(() => setSearchOpen(true))
  const activeItem =
    ALL_NAV_ITEMS.find((i) => pathname === i.to || pathname.startsWith(`${i.to}/`)) ??
    ALL_NAV_ITEMS[0]
  const parentTo = PARENT_ROUTE[activeItem.to]
  const parentLabel = parentTo ? ROUTE_LABELS[parentTo] : null

  const { data: stats } = useQuery(dashboardStatsQueryOptions())

  const navGroups: NavGroup[] = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items
      .filter((item) => {
        const perm = permissionForPath(item.to)
        return !perm || can(perm)
      })
      .map((item): NavItem => {
        if (item.to === '/dashboard' && stats?.issuesCount) {
          return {
            ...item,
            dot: { tone: 'destructive', label: `Проблем в инвентаре: ${stats.issuesCount}` },
          }
        }
        if (item.to === '/accounts' && stats?.lowBalanceAccountCount) {
          return {
            ...item,
            dot: {
              tone: 'warning',
              label: `Низкий баланс: ${stats.lowBalanceAccountCount}`,
            },
          }
        }
        return item
      }),
  })).filter((g) => g.items.length > 0)

  return (
    <SpaceProvider>
    <TooltipProvider delay={0}>
      <SidebarProvider
        style={
          {
            '--sidebar-width': '240px',
          } as CSSProperties
        }
      >
        <a href="#main-content" className={SKIP_TO_CONTENT_CLASS}>
          К содержимому
        </a>
        <Sidebar collapsible="icon">
          <SidebarHeader>
            <AppSwitcher />
            <SpaceSwitcher />
          </SidebarHeader>
          <SidebarContent>
            {navGroups.map((group) => (
              <NavGroupSection key={group.label} group={group} pathname={pathname} />
            ))}
          </SidebarContent>
          <SidebarFooter>
            <NavUser />
          </SidebarFooter>
        </Sidebar>
        <SidebarInset id="main-content">
          <header className="bg-background sticky top-0 z-10 flex h-12 shrink-0 items-center gap-2 border-b px-4 md:px-6">
            <SidebarTrigger className="-ml-1" />
            <Breadcrumb>
              <BreadcrumbList>
                {parentLabel && parentTo ? (
                  <>
                    <BreadcrumbItem className="hidden md:block">
                      <BreadcrumbLink render={<Link to={parentTo} />}>
                        {parentLabel}
                      </BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator className="hidden md:block" />
                  </>
                ) : null}
                <BreadcrumbItem>
                  <BreadcrumbPage>
                    {ROUTE_LABELS[activeItem.to] ?? ''}
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
            <div className="ml-auto flex items-center gap-2">
              <SystemMonitorPopover />
            </div>
          </header>
          <div className="flex min-w-0 flex-1 flex-col gap-4 px-4 py-4 md:gap-6 md:px-6 md:py-5">
            <SpaceScopedMain>{children}</SpaceScopedMain>
          </div>
        </SidebarInset>
        <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
      </SidebarProvider>
    </TooltipProvider>
    </SpaceProvider>
  )
}

/** Collapsible nav group (design `grph`): uppercase label + chevron; always open in icon rail. */
function NavGroupSection({ group, pathname }: { group: NavGroup; pathname: string }) {
  const { state, isMobile } = useSidebar()
  const [open, setOpen] = useState(true)
  const iconRail = state === 'collapsed' && !isMobile

  return (
    <Collapsible open={open || iconRail} onOpenChange={setOpen}>
      <SidebarGroup>
        <SidebarGroupLabel
          render={<CollapsibleTrigger />}
          className="group/label hover:text-sidebar-foreground cursor-pointer uppercase tracking-wider transition-colors"
        >
          {group.label}
          <ChevronDownIcon className="ml-auto transition-transform motion-reduce:transition-none group-not-data-panel-open/label:-rotate-90" />
        </SidebarGroupLabel>
        <CollapsibleContent>
          <SidebarGroupContent>
            <SidebarMenu>
              {group.items.map((item) => {
                const Icon = item.icon
                const isActive = pathname === item.to || pathname.startsWith(`${item.to}/`)
                return (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton
                      render={<Link to={item.to} />}
                      isActive={isActive}
                      tooltip={item.label}
                    >
                      <Icon className="size-4" />
                      <span>{item.label}</span>
                      {item.dot ? (
                        <span
                          role="img"
                          aria-label={item.dot.label}
                          className={cn(
                            'ml-auto size-2 shrink-0 rounded-full',
                            'group-data-[collapsible=icon]:absolute group-data-[collapsible=icon]:top-1 group-data-[collapsible=icon]:right-1',
                            item.dot.tone === 'destructive' ? 'bg-destructive' : 'bg-warning',
                          )}
                        />
                      ) : null}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </CollapsibleContent>
      </SidebarGroup>
    </Collapsible>
  )
}

/** Remount route content when space changes so snapshot queries pick new X-Space-Id. */
function SpaceScopedMain({ children }: { children: ReactNode }) {
  const { spaceId } = useSpaceId()
  return (
    <div key={spaceId ?? 'default'} className="flex min-w-0 flex-1 flex-col gap-4 md:gap-6">
      {children}
    </div>
  )
}
