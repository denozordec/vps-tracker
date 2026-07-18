import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import { snapshotQueryOptions } from '@/queries/snapshot'
import {
  can,
  ensureAuthConfig,
  firstAllowedPath,
  getClaims,
  getToken,
  permissionForPath,
  redirectToPortalLogin,
} from '@/lib/auth'

export const Route = createFileRoute('/_auth')({
  beforeLoad: async ({ location }) => {
    const cfg = await ensureAuthConfig()
    if (!cfg.required) return

    const token = getToken()
    const claims = getClaims()
    if (!token || !claims) {
      const ok = redirectToPortalLogin(
        `${window.location.origin}/auth/callback`,
      )
      if (!ok) {
        throw redirect({
          to: '/auth/callback',
          search: { error: 'sso_loop' },
        })
      }
      // Abort route load while browser navigates away
      await new Promise(() => {})
      return
    }
    if (!claims.apps.includes('vps')) {
      throw redirect({ to: '/' })
    }

    const perm = permissionForPath(location.pathname)
    if (perm && !can(perm)) {
      const fallback = firstAllowedPath()
      if (fallback !== location.pathname) {
        throw redirect({ to: fallback })
      }
    }
  },
  loader: ({ context: { queryClient } }) =>
    queryClient.ensureQueryData(snapshotQueryOptions()),
  component: AuthLayout,
})

function AuthLayout() {
  return <Outlet />
}
