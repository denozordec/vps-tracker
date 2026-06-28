import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { closeDb } from '@cfdm/db'
import { notificationRepository } from '@cfdm/db/repositories/notifications'
import { resetTestDb } from '@cfdm/db/test-setup'
import { shouldSkipDedup, markDedupSent } from './dedup.js'

describe('notification dedup', () => {
  beforeEach(() => {
    resetTestDb()
  })

  afterEach(() => {
    closeDb()
  })

  it('skips duplicate fingerprint mode', () => {
    expect(shouldSkipDedup('sync_digest', 'fp-1', 'fingerprint')).toBe(false)
    markDedupSent('sync_digest', 'fp-1', 'fingerprint')
    expect(shouldSkipDedup('sync_digest', 'fp-1', 'fingerprint')).toBe(true)
    expect(shouldSkipDedup('sync_digest', 'fp-2', 'fingerprint')).toBe(false)
  })

  it('skips state_transition when status unchanged', () => {
    markDedupSent('vps_down', 'host-a', 'state_transition', 'vps_health:vps_down', 'host-a')
    expect(
      shouldSkipDedup('vps_down', 'host-a', 'state_transition', 'vps_health:vps_down', 'host-a'),
    ).toBe(true)
    expect(
      shouldSkipDedup('vps_down', 'host-a|host-b', 'state_transition', 'vps_health:vps_down', 'host-a|host-b'),
    ).toBe(false)
  })

  it('logs skipped entries via repository', () => {
    notificationRepository.append({
      event: 'test',
      channel: 'webhook',
      status: 'skipped',
      fingerprint: 'x',
      message: 'msg',
    })
    const rows = notificationRepository.listRecent(5)
    expect(rows).toHaveLength(1)
    expect(rows[0]?.status).toBe('skipped')
  })
})
