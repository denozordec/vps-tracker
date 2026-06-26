import { QueryClient } from '@tanstack/react-query'
import {
  createRouter as tanstackCreateRouter,
  rootRouteId,
} from '@tanstack/react-router'

import { routeTree } from '../routeTree.gen'
import { queryClient } from './queryClient'

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createRouter>
  }
}

export function createRouter(opts?: { context?: { queryClient: QueryClient } }) {
  return tanstackCreateRouter({
    routeTree,
    context: opts?.context ?? { queryClient },
    defaultPreload: 'intent',
    scrollRestoration: true,
  })
}

export { rootRouteId }
