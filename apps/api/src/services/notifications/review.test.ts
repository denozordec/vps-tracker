import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { closeDb, getSqlite, MAIN_SPACE_ID, runWithSpace } from '@cfdm/db'
import { resetTestDb } from '@cfdm/db/test-setup'
import { buildPaymentExpiryNotification, buildSyncDigestNotification, buildVpsHealthNotification } from './rules.js'
import { markDedupSent, shouldSkipDedup } from './dedup.js'
import { publishNotification } from './engine.js'
import { fitTelegramText, sendTelegramMessage } from '../telegram.js'

describe('notifications review fixes', () => {
  beforeEach(() => {
    resetTestDb()
    getSqlite().exec(`INSERT INTO spaces (id, name, slug, kind, createdAt) VALUES ('space-x', 'X', 'x', 'personal', '2026-01-01')`)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    closeDb()
  })

  it('payment expiry only lists VPS of the current space', () => {
    const now = new Date('2026-06-01T12:00:00Z')
    getSqlite()
      .prepare(`INSERT INTO vps (id, spaceId, ip, dns, status, paidUntil) VALUES ('v-x', 'space-x', '1.1.1.1', 'x.example', 'active', '2026-06-03')`)
      .run()
    expect(runWithSpace(MAIN_SPACE_ID, () => buildPaymentExpiryNotification(now))).toBeNull()
    expect(runWithSpace('space-x', () => buildPaymentExpiryNotification(now))?.messagePlain).toContain('x.example')
  })

  it('dedup state does not collide between spaces', () => {
    runWithSpace(MAIN_SPACE_ID, () => markDedupSent('payment_expiry', 'fp-main', 'daily'))
    runWithSpace('space-x', () => markDedupSent('payment_expiry', 'fp-x', 'daily'))
    expect(runWithSpace('space-x', () => shouldSkipDedup('payment_expiry', 'fp-x', 'daily'))).toBe(true)
    expect(runWithSpace(MAIN_SPACE_ID, () => shouldSkipDedup('payment_expiry', 'fp-main', 'daily'))).toBe(true)
  })

  it('escapes hoster text in HTML', () => {
    const p = buildSyncDigestNotification(['✗ Acc <1>: <html>502 & co'])
    expect(p?.messageHtml).toContain('Acc &lt;1&gt;: &lt;html&gt;502 &amp; co')
    expect(p?.messageHtml).toContain('<b>')
  })

  it('cuts long text at a line break under the Telegram limit', () => {
    const text = Array.from({ length: 500 }, (_, i) => `• host-${i} &amp; more`).join('\n')
    const out = fitTelegramText(text)
    expect(out.length).toBeLessThanOrEqual(4096)
    expect(out).toMatch(/… и ещё \d+ строк$/)
    expect(fitTelegramText('short')).toBe('short')
  })

  it('repeat outage of the same VPS is sent again', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => new Response('{}'))
    vi.stubGlobal('fetch', fetchMock)
    const settings = { webhookEnabled: 1, webhookUrl: 'https://hook.test' }
    const down = buildVpsHealthNotification('vps_down', [{ id: 'v1', label: 'v1' }])!
    expect(await publishNotification(settings, down)).toBe('sent')
    expect(await publishNotification(settings, down)).toBe('sent')
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[0]?.[1]?.signal).toBeInstanceOf(AbortSignal)
  })

  it('keeps errors of failed chats on partial delivery and sets a timeout', async () => {
    const fetchMock = vi.fn<typeof fetch>(async (_url, init) => {
      const chat = JSON.parse(String(init?.body)).chat_id
      return Response.json(chat === 'a' ? { ok: true } : { ok: false, description: 'Bad Request: chat not found' })
    })
    vi.stubGlobal('fetch', fetchMock)
    const r = await sendTelegramMessage('tok', 'a,b', 'hi')
    expect(r.ok).toBe(true)
    expect(r.error).toContain('b: Bad Request: chat not found')
    expect(fetchMock.mock.calls[0]?.[1]?.signal).toBeInstanceOf(AbortSignal)
  })
})
