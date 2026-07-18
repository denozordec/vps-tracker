import { createFileRoute, redirect } from '@tanstack/react-router'
import {
  ensureAuthConfig,
  firstAllowedPath,
  getClaims,
  getToken,
  parseHashToken,
  redirectToPortalLogin,
  setToken,
} from '@/lib/auth'

export const Route = createFileRoute('/auth/callback')({
  beforeLoad: async () => {
    await ensureAuthConfig()
    const { accessToken } = parseHashToken(window.location.hash)
    if (accessToken) {
      setToken(accessToken)
      // Do not replaceState to strip the hash here — that re-triggers beforeLoad
      // with an empty hash and sends the user back to the portal (SSO loop).
      sessionStorage.removeItem('vps_auth_401_handoff')
      throw redirect({ to: firstAllowedPath() })
    }
    // Already stored from a previous parse (e.g. remount) — finish handoff.
    if (getToken() && getClaims()) {
      throw redirect({ to: firstAllowedPath() })
    }
    redirectToPortalLogin(`${window.location.origin}/auth/callback`)
    await new Promise(() => {})
  },
  component: () => null,
})
