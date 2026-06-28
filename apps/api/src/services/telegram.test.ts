import { describe, expect, it } from 'vitest'
import { formatTelegramApiError, telegramErrorHint } from './telegram.js'

describe('telegramErrorHint', () => {
  it('maps thread not found', () => {
    expect(telegramErrorHint('Bad Request: message thread not found')).toContain('Thread ID')
  })

  it('maps chat not found', () => {
    expect(telegramErrorHint('Bad Request: chat not found')).toContain('Chat ID')
  })

  it('returns null for unknown errors', () => {
    expect(telegramErrorHint('Something else')).toBeNull()
  })
})

describe('formatTelegramApiError', () => {
  it('includes hint for known telegram description', () => {
    const msg = formatTelegramApiError(
      '-1001',
      { status: 400, statusText: 'Bad Request' },
      { ok: false, description: 'Bad Request: message thread not found' },
    )
    expect(msg).toContain('message thread not found')
    expect(msg).toContain('Thread ID')
  })

  it('falls back to raw body when JSON has no description', () => {
    const msg = formatTelegramApiError(
      '-1001',
      { status: 400, statusText: 'Bad Request' },
      {},
      'invalid payload',
    )
    expect(msg).toBe('-1001: invalid payload')
  })
})
