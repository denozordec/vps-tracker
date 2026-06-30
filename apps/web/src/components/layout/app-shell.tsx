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

import { Link, useRouterState } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'

import { ModeToggle } from '@/components/mode-toggle'
import { AppSwitcher } from '@/components/app-switcher'
import { GlobalSearch, GlobalSearchTrigger, useGlobalSearchHotkey } from '@/components/global-search'
import { dashboardStatsQueryOptions } from '@/queries/dashboard'
import { formatRelativeSyncTime } from '@/lib/sync-format'
import { TruncatedText } from '@/components/truncated-text'

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

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const [searchOpen, setSearchOpen] = useState(false)
  useGlobalSearchHotkey(() => setSearchOpen(true))
  const activeItem = ALL_NAV_ITEMS.find((i) => pathname === i.to || pathname.startsWith(`${i.to}/`)) ?? ALL_NAV_ITEMS[0]
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
    <SidebarProvider>
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
                    const isActive = pathname === item.to || pathname.startsWith(`${item.to}/`)
                    return (
                      <SidebarMenuItem key={item.to}>
                        <SidebarMenuButton
                          render={<Link to={item.to} />}
                          isActive={isActive}
                          tooltip={item.label}
                        >
                          <Icon />
                          <span>{item.label}</span>
                          {item.badge ? (
                            <Badge variant="destructive" className="ml-auto size-5 justify-center p-0 text-xs">
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
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton render={<Link to="/settings" />} tooltip="Настройки">
                <Settings />
                <TruncatedText
                  className="text-xs text-muted-foreground"
                  tooltip={`Синк: ${formatRelativeSyncTime(stats?.lastGlobalSyncAt)}`}
                >
                  Синк: {formatRelativeSyncTime(stats?.lastGlobalSyncAt)}
                </TruncatedText>
                {stats?.staleSyncAccountCount ? (
                  <Badge variant="outline" className="ml-auto text-xs">
                    <RefreshCwIcon className="size-3" />
                    {stats.staleSyncAccountCount}
                  </Badge>
                ) : null}
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <SidebarTrigger />
          <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              {parentLabel && parentTo ? (
                <>
                  <BreadcrumbItem className="hidden md:block">
                    <BreadcrumbLink render={<Link to={parentTo} />}>{parentLabel}</BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator className="hidden md:block" />
                </>
              ) : null}
              <BreadcrumbItem>
                <BreadcrumbPage>{ROUTE_LABELS[activeItem.to] ?? ''}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <div className="ml-auto flex items-center gap-2">
            <GlobalSearchTrigger onClick={() => setSearchOpen(true)} />
            {stats?.issuesCount ? (
              <Badge variant="destructive" className="hidden sm:inline-flex">
                {stats.issuesCount} проблем
              </Badge>
            ) : null}
            <ModeToggle />
          </div>
        </header>
        <main className="flex flex-1 flex-col gap-4 p-4 md:gap-6 md:p-6">{children}</main>
      </SidebarInset>
      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
    </SidebarProvider>
  )
}
