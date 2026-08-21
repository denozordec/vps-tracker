import { describe, expect, it } from 'vitest'
import {
  formatTelegramApiError,
  telegramErrorHint,
  telegramSendMessageUrl,
} from './telegram.js'
import { DEFAULT_TELEGRAM_API_URL } from '@cfdm/shared/contracts/settings'

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

describe('telegramSendMessageUrl', () => {
  it('uses cloud origin by default', () => {
    expect(telegramSendMessageUrl('TOKEN')).toBe(
      `${DEFAULT_TELEGRAM_API_URL}/botTOKEN/sendMessage`,
    )
  })

  it('builds local HTTP origin', () => {
    expect(telegramSendMessageUrl('TOKEN', 'http://127.0.0.1:8081')).toBe(
      'http://127.0.0.1:8081/botTOKEN/sendMessage',
    )
  })

  it('builds HTTPS reverse-proxy origin', () => {
    expect(telegramSendMessageUrl('TOKEN', 'https://bots.example.com')).toBe(
      'https://bots.example.com/botTOKEN/sendMessage',
    )
  })

  it('strips trailing slash and /bot suffix', () => {
    expect(telegramSendMessageUrl('TOKEN', 'http://127.0.0.1:8081/')).toBe(
      'http://127.0.0.1:8081/botTOKEN/sendMessage',
    )
    expect(telegramSendMessageUrl('TOKEN', 'http://127.0.0.1:8081/bot')).toBe(
      'http://127.0.0.1:8081/botTOKEN/sendMessage',
    )
  })
})
