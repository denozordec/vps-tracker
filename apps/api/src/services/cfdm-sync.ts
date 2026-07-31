import { settingsRepository } from '@cfdm/db/repositories/settings'

function resolveCfdmApiBase(): string | null {
  const row = settingsRepository.getBySpace()
  if (!row) return null
  const explicit = row.cfdmApiUrl?.trim()
  if (explicit) return explicit.replace(/\/$/, '')
  const cfdm = settingsRepository.getAppSwitcher().apps.find((a) => a.id === 'cfdm')
  return cfdm?.url?.trim().replace(/\/$/, '') ?? null
}

export async function requestCfdmFullSync(): Promise<{
  ok: boolean
  count?: number
  error?: string
}> {
  const row = settingsRepository.getBySpace()
  if (!row?.integrationEnabled) {
    return { ok: false, error: 'Включите приём синхронизации' }
  }

  const token = settingsRepository.getIntegrationToken()
  const baseUrl = resolveCfdmApiBase()
  if (!baseUrl) return { ok: false, error: 'Укажите URL API CFDM' }
  if (!token) return { ok: false, error: 'Укажите integration token' }

  try {
    const res = await fetch(`${baseUrl}/api/v1/integrations/vps-tracker/sync`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
    const body = (await res.json().catch(() => ({}))) as {
      ok?: boolean
      count?: number
      error?: string
    }
    if (!res.ok || body.ok === false) {
      return {
        ok: false,
        error: body.error ?? `HTTP ${res.status}`,
      }
    }
    return { ok: true, count: body.count ?? 0 }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Ошибка сети',
    }
  }
}
