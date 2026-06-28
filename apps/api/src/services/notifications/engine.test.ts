import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { closeDb } from '@cfdm/db'
import { resetTestDb } from '@cfdm/db/test-setup'
import { publishNotification } from './engine.js'
import type { NotificationPayload } from './types.js'

describe('notification engine', () => {
  beforeEach(() => {
    resetTestDb()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('ok', { status: 200 })),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    closeDb()
  })

  it('sends webhook without telegram configured', async () => {
    const payload: NotificationPayload = {
      event: 'payment_expiry',
      fingerprint: 'fp-test',
      messagePlain: 'test message',
      dedup: 'fingerprint',
    }
    const result = await publishNotification(
      {
        notifyPaymentExpiryEnabled: true,
        webhookEnabled: true,
        webhookUrl: 'https://example.com/hook',
      },
      payload,
    )
    expect(result).toBe('sent')
    expect(fetch).toHaveBeenCalled()
  })

  it('skips when event disabled', async () => {
    const payload: NotificationPayload = {
      event: 'payment_expiry',
      fingerprint: 'fp-test',
      messagePlain: 'test',
      dedup: 'fingerprint',
    }
    const result = await publishNotification(
      {
        notifyPaymentExpiryEnabled: false,
        webhookEnabled: true,
        webhookUrl: 'https://example.com/hook',
      },
      payload,
    )
    expect(result).toBe('skipped')
    expect(fetch).not.toHaveBeenCalled()
  })
})
