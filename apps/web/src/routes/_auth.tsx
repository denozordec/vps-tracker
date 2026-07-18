import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import { snapshotQueryOptions } from '@/queries/snapshot'
import {
  can,
  firstAllowedPath,
  getClaims,
  getToken,
  isAuthEnabled,
  permissionForPath,
  redirectToPortalLogin,
} from '@/lib/auth'

export const Route = createFileRoute('/_auth')({
  beforeLoad: ({ location }) => {
    if (!isAuthEnabled()) return

    const token = getToken()
    const claims = getClaims()
    if (!token || !claims) {
      redirectToPortalLogin(`${window.location.origin}/auth/callback`)
      throw new Error('Redirecting to auth portal')
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
