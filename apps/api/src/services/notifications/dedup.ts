import { notificationRepository } from '@cfdm/db/repositories/notifications'
import type { DedupMode } from './types.js'

const DAY_MS = 24 * 60 * 60 * 1000

export function shouldSkipDedup(
  event: string,
  fingerprint: string,
  mode: DedupMode,
  stateKey?: string,
  newStatus?: string,
): boolean {
  const key = stateKey ?? event
  const state = notificationRepository.getState(key)
  const now = Date.now()

  if (mode === 'state_transition') {
    if (!newStatus) return false
    if (state?.lastStatus === newStatus) return true
    return false
  }

  if (mode === 'fingerprint') {
    if (state?.lastFingerprint === fingerprint) return true
    return false
  }

  // daily
  if (state?.lastFingerprint === fingerprint && state.lastSentAt) {
    const last = new Date(state.lastSentAt).getTime()
    if (!Number.isNaN(last) && now - last < DAY_MS) return true
  }
  return false
}

export function markDedupSent(
  event: string,
  fingerprint: string,
  mode: DedupMode,
  stateKey?: string,
  newStatus?: string,
): void {
  const key = stateKey ?? event
  notificationRepository.upsertState(key, {
    lastFingerprint: fingerprint,
    lastSentAt: new Date().toISOString(),
    lastStatus: mode === 'state_transition' ? newStatus : undefined,
  })
}
