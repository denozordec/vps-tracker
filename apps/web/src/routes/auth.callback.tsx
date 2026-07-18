import { createFileRoute, redirect } from '@tanstack/react-router'
import {
  ensureAuthConfig,
  firstAllowedPath,
  parseHashToken,
  redirectToPortalLogin,
  setToken,
} from '@/lib/auth'

export const Route = createFileRoute('/auth/callback')({
  beforeLoad: async () => {
    await ensureAuthConfig()
    const { accessToken } = parseHashToken(window.location.hash)
    if (!accessToken) {
      redirectToPortalLogin(`${window.location.origin}/auth/callback`)
      await new Promise(() => {})
      return
    }
    setToken(accessToken)
    window.history.replaceState(null, '', '/auth/callback')
    throw redirect({ to: firstAllowedPath() })
  },
  component: () => null,
})
