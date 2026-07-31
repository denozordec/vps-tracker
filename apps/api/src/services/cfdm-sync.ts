import { settingsRepository } from '@cfdm/db/repositories/settings'
import { vpsDomainsRepository } from '@cfdm/db/repositories/vps-domains'
import {
  cfdmSyncBindingsBodySchema,
  type CfdmBindingSyncItem,
} from '@cfdm/shared/contracts/integration-cfdm'

function isUsableHttpUrl(raw: string): boolean {
  try {
    const u = new URL(raw)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false
    const host = u.hostname.toLowerCase()
    if (host === 'example.com' || host.endsWith('.example.com')) return false
    return true
  } catch {
    return false
  }
}

function resolveCfdmApiBase(): string | null {
  const row = settingsRepository.getBySpace()
  if (!row) return null
  const explicit = row.cfdmApiUrl?.trim()
  if (explicit && isUsableHttpUrl(explicit)) return explicit.replace(/\/$/, '')
  const cfdm = settingsRepository.getAppSwitcher().apps.find((a) => a.id === 'cfdm')
  const fromSwitcher = cfdm?.url?.trim().replace(/\/$/, '') ?? ''
  if (fromSwitcher && isUsableHttpUrl(fromSwitcher)) return fromSwitcher
  return null
}

function networkErrorMessage(baseUrl: string, err: unknown): string {
  const raw = err instanceof Error ? err.message : 'Ошибка сети'
  return (
    `Не удалось подключиться к CFDM (${baseUrl}): ${raw}. ` +
    'Укажите URL API CFDM (доступный с хоста VPS Tracker API) и сохраните.'
  )
}

export async function requestCfdmFullSync(): Promise<{
  ok: boolean
  count?: number
  error?: string
}> {
  const token = settingsRepository.getIntegrationToken()
  const baseUrl = resolveCfdmApiBase()
  if (!baseUrl) {
    return {
      ok: false,
      error:
        'Укажите URL API CFDM в настройках интеграции (или добавьте приложение cfdm в App Switcher)',
    }
  }
  if (!token) return { ok: false, error: 'Укажите integration token' }

  const syncUrl = `${baseUrl}/api/v1/integrations/vps-tracker/sync`

  try {
    const res = await fetch(syncUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(60_000),
    })
    const body = (await res.json().catch(() => ({}))) as {
      ok?: boolean
      count?: number
      error?: string
      bindings?: CfdmBindingSyncItem[]
      fullSync?: boolean
    }

    if (!res.ok || body.ok === false) {
      return {
        ok: false,
        error: body.error ?? `CFDM HTTP ${res.status} (${syncUrl})`,
      }
    }

    // Pull: CFDM отдаёт bindings в ответе — применяем локально (без обратного push).
    if (Array.isArray(body.bindings)) {
      const parsed = cfdmSyncBindingsBodySchema.safeParse({
        bindings: body.bindings,
        fullSync: body.fullSync !== false,
      })
      if (!parsed.success) {
        return {
          ok: false,
          error: `Некорректный ответ CFDM: ${parsed.error.message}`,
        }
      }
      const applied = vpsDomainsRepository.syncBindings(parsed.data.bindings, {
        fullSync: parsed.data.fullSync === true,
      })
      settingsRepository.touchIntegrationSync()
      return {
        ok: true,
        count: parsed.data.bindings.length || applied.upserted,
      }
    }

    // Legacy: CFDM уже запушил bindings сам и вернул только count.
    settingsRepository.touchIntegrationSync()
    return { ok: true, count: body.count ?? 0 }
  } catch (err) {
    return {
      ok: false,
      error: networkErrorMessage(baseUrl, err),
    }
  }
}
