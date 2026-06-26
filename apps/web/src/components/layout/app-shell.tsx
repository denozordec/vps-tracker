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
  BreadcrumbList,
  BreadcrumbPage,
} from '@cfdm/ui/components/breadcrumb'
import { Separator } from '@cfdm/ui/components/separator'

import { Link, useRouterState } from '@tanstack/react-router'
import type { ReactNode } from 'react'

interface NavItem {
  to: string
  label: string
  icon: typeof LayoutDashboard
}

const NAV_ITEMS: NavItem[] = [
  { to: '/dashboard', label: 'Дашборд', icon: LayoutDashboard },
  { to: '/vps', label: 'VPS', icon: Server },
  { to: '/tariffs', label: 'Активные тарифы', icon: ServerCog },
  { to: '/providers', label: 'Хостеры', icon: Building2 },
  { to: '/accounts', label: 'Аккаунты хостеров', icon: Wallet },
  { to: '/payments', label: 'Платежи', icon: CreditCard },
  { to: '/balance', label: 'Баланс и списания', icon: Coins },
  { to: '/reports', label: 'Отчёты', icon: ChartColumnBig },
  { to: '/resources', label: 'Ресурсы', icon: ChartBar },
  { to: '/settings', label: 'Настройки', icon: Settings },
]

const ROUTE_LABELS: Record<string, string> = Object.fromEntries(
  NAV_ITEMS.map((i) => [i.to, i.label]),
)

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const activeItem = NAV_ITEMS.find((i) => pathname.startsWith(i.to)) ?? NAV_ITEMS[0]

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <div className="flex items-center gap-2 px-2 py-1.5">
            <div className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Server className="size-4" />
            </div>
            <div className="flex flex-col text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
              <span className="font-semibold">VPS Tracker</span>
              <span className="text-xs text-muted-foreground">Учёт виртуальных серверов</span>
            </div>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Меню</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {NAV_ITEMS.map((item) => {
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
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter />
      </Sidebar>
      <SidebarInset>
        <header className="sticky top-0 flex h-16 shrink-0 items-center gap-2 border-b bg-background/95 px-4 backdrop-supports">
          <SidebarTrigger />
          <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbPage>{ROUTE_LABELS[activeItem.to] ?? ''}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </header>
        <main className="flex flex-1 flex-col gap-4 p-4 md:gap-6 md:p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  )
}
