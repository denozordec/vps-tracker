import { createFileRoute, redirect } from '@tanstack/react-router'
import {
  firstAllowedPath,
  isAuthEnabled,
  parseHashToken,
  setToken,
} from '@/lib/auth'

export const Route = createFileRoute('/auth/callback')({
  beforeLoad: () => {
    if (!isAuthEnabled()) {
      throw redirect({ to: '/dashboard' })
    }
    const { accessToken } = parseHashToken(window.location.hash)
    if (!accessToken) {
      throw redirect({ to: '/' })
    }
    setToken(accessToken)
    window.history.replaceState(null, '', '/auth/callback')
    throw redirect({ to: firstAllowedPath() })
  },
  component: () => null,
})
