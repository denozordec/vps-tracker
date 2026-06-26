import { Outlet, createRootRouteWithContext } from '@tanstack/react-router'
import { AppShell } from '@/components/layout/app-shell'

interface RouterContext {
  queryClient: import('@tanstack/react-query').QueryClient
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootComponent,
})

function RootComponent() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  )
}
