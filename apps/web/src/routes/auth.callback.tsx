import { createFileRoute, redirect } from '@tanstack/react-router'
import {
  authPortalUrl,
  clearPortalHandoffFlag,
  clearToken,
  ensureAuthConfig,
  firstAllowedPath,
  getClaims,
  getToken,
  parseHashToken,
  redirectToPortalLogin,
  setToken,
} from '@/lib/auth'

export const Route = createFileRoute('/auth/callback')({
  validateSearch: (search: Record<string, unknown>) => ({
    error: typeof search.error === 'string' ? search.error : undefined,
  }),
  beforeLoad: async ({ search }) => {
    await ensureAuthConfig()

    if (search.error === 'sso_loop') {
      return
    }

    const { accessToken } = parseHashToken(window.location.hash)
    if (accessToken) {
      setToken(accessToken)
      // Keep handoff timestamp for cooldown; only clear the per-load flag.
      clearPortalHandoffFlag()
      const claims = getClaims()
      if (!claims) {
        clearToken()
        // Expired/invalid token from portal — force interactive login (no return_to storm)
        window.location.assign(authPortalUrl())
        await new Promise(() => {})
        return
      }
      throw redirect({ to: firstAllowedPath() })
    }
    // Already stored from a previous parse (e.g. remount) — finish handoff.
    if (getToken() && getClaims()) {
      clearPortalHandoffFlag()
      throw redirect({ to: firstAllowedPath() })
    }
    const ok = redirectToPortalLogin(`${window.location.origin}/auth/callback`)
    if (!ok) {
      throw redirect({ to: '/auth/callback', search: { error: 'sso_loop' } })
    }
    await new Promise(() => {})
  },
  component: AuthCallbackPage,
})

function AuthCallbackPage() {
  const { error } = Route.useSearch()
  if (error === 'sso_loop') {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-3 p-6 text-center">
        <h1 className="text-lg font-semibold">Сессия не принята</h1>
        <p className="text-muted-foreground max-w-md text-sm">
          Повторный вход через portal остановлен (защита от цикла редиректов).
          Обычно это несовпадение JWT_SECRET / ISSUER или просроченный токен.
          Войдите заново на portal, затем откройте VPS Tracker.
        </p>
        <a
          className="text-primary text-sm underline"
          href={authPortalUrl()}
        >
          Открыть Auth Portal
        </a>
      </div>
    )
  }
  return null
}
