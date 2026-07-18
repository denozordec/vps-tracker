import { settingsRepository } from '@cfdm/db/repositories/settings'
import { vpsRepository } from '@cfdm/db/repositories/vps'
import type { VpsTrackerEvent } from '@cfdm/shared/contracts/integration-cfdm'

function resolveCfdmApiBase(): string | null {
  const row = settingsRepository.getBySpace()
  if (!row) return null
  const explicit = row.cfdmApiUrl?.trim()
  if (explicit) return explicit.replace(/\/$/, '')
  const cfdm = settingsRepository.getAppSwitcher().apps.find((a) => a.id === 'cfdm')
  return cfdm?.url?.trim().replace(/\/$/, '') ?? null
}

export async function notifyCfdmVpsEvent(
  event: VpsTrackerEvent['event'],
  vpsIds: string[],
): Promise<void> {
  if (vpsIds.length === 0) return

  const row = settingsRepository.getBySpace()
  if (!row?.integrationEnabled) return

  const token = settingsRepository.getIntegrationToken()
  const baseUrl = resolveCfdmApiBase()
  if (!baseUrl || !token) return

  const payload: VpsTrackerEvent = {
    event,
    vps: vpsIds.map((id) => {
      const vps = vpsRepository.get(id)
      return {
        id,
        ip: vps?.ip ?? undefined,
        label: vps?.dns || vps?.ip || id,
      }
    }),
    timestamp: new Date().toISOString(),
  }

  try {
    const res = await fetch(`${baseUrl}/api/v1/integrations/vps-tracker/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      console.warn(`CFDM event notify failed (${res.status})`)
    }
  } catch (err) {
    console.warn('CFDM event notify error:', err instanceof Error ? err.message : err)
  }
}
