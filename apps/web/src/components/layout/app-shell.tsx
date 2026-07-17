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
} from '@cfdm/ui/components/sidebar'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@cfdm/ui/components/breadcrumb'
import { Separator } from '@cfdm/ui/components/separator'
import { Badge } from '@cfdm/ui/components/badge'
import { TooltipProvider } from '@cfdm/ui/components/tooltip'

import { Link, useRouterState } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useState, type CSSProperties, type ReactNode } from 'react'

import { ModeToggle } from '@/components/mode-toggle'
import { SystemMonitorPopover } from '@/components/layout/system-monitor-popover'
import { AppsMenu } from '@/components/layout/apps-menu'
import { AppSwitcher } from '@/components/app-switcher'
import { GlobalSearch, useGlobalSearchHotkey } from '@/components/global-search'
import { dashboardStatsQueryOptions } from '@/queries/dashboard'

interface NavItem {
  to: string
  label: string
  icon: typeof LayoutDashboard
  badge?: number
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
    items: group.items.map((item) => {
      if (item.to === '/dashboard' && stats?.issuesCount) {
        return { ...item, badge: stats.issuesCount }
      }
      return item
    }),
  }))

  return (
    <TooltipProvider delay={0}>
      <SidebarProvider
        style={
          {
            '--sidebar-width': '240px',
          } as CSSProperties
        }
      >
        <Sidebar collapsible="icon">
          <SidebarHeader>
            <AppSwitcher />
          </SidebarHeader>
          <SidebarContent>
            {navGroups.map((group) => (
              <SidebarGroup key={group.label}>
                <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {group.items.map((item) => {
                      const Icon = item.icon
                      const isActive =
                        pathname === item.to || pathname.startsWith(`${item.to}/`)
                      return (
                        <SidebarMenuItem key={item.to}>
                          <SidebarMenuButton
                            render={<Link to={item.to} />}
                            isActive={isActive}
                            tooltip={item.label}
                          >
                            <Icon className="size-4" />
                            <span>{item.label}</span>
                            {item.badge ? (
                              <Badge
                                variant="destructive"
                                className="ml-auto size-5 justify-center p-0 text-xs"
                              >
                                {item.badge}
                              </Badge>
                            ) : null}
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      )
                    })}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            ))}
          </SidebarContent>
          <SidebarFooter />
        </Sidebar>
        <SidebarInset>
          <header className="bg-background sticky top-0 z-10 flex h-12 shrink-0 items-center gap-2 border-b px-4 md:px-6">
            <SidebarTrigger className="-ml-1" />
            <Separator
              orientation="vertical"
              className="mr-2 data-[orientation=vertical]:h-4"
            />
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
              <AppsMenu />
              <SystemMonitorPopover />
              <ModeToggle />
            </div>
          </header>
          <main className="flex flex-1 flex-col gap-4 px-4 py-4 md:gap-6 md:px-6 md:py-5">
            {children}
          </main>
        </SidebarInset>
        <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
      </SidebarProvider>
    </TooltipProvider>
  )
}
