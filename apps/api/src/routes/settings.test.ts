import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { closeDb } from '@cfdm/db'
import { settingsRepository } from '@cfdm/db/repositories/settings'
import { resetTestDb } from '@cfdm/db/test-setup'
import { buildApp } from '../index.js'

describe('settings telegram test', () => {
  let app: Awaited<ReturnType<typeof buildApp>>

  beforeEach(async () => {
    resetTestDb()
    settingsRepository.upsert('settings-main', {
      telegramBotToken: 'db-token',
      telegramChatId: '123',
      telegramMessageThreadId: '99',
    })
    app = await buildApp()
  })

  afterEach(async () => {
    await app.close()
    vi.unstubAllGlobals()
    closeDb()
  })

  it('returns telegram API error with hint', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({ ok: false, description: 'Bad Request: chat not found' }),
      ),
    )
    const res = await app.inject({ method: 'POST', url: '/api/settings/telegram/test' })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { ok: boolean; error?: string }
    expect(body.ok).toBe(false)
    expect(body.error).toContain('chat not found')
    expect(body.error).toContain('Chat ID')
  })

  it('uses body overrides and falls back to db token', async () => {
    const fetchMock = vi.fn(async () => Response.json({ ok: true }))
    vi.stubGlobal('fetch', fetchMock)

    const res = await app.inject({
      method: 'POST',
      url: '/api/settings/telegram/test',
      payload: {
        telegramChatId: '-100999',
        telegramMessageThreadId: '42',
      },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { ok: boolean }
    expect(body.ok).toBe(true)

    const call = fetchMock.mock.calls[0] as [string, RequestInit] | undefined
    expect(call).toBeDefined()
    const sent = JSON.parse(String(call![1].body)) as {
      chat_id: string
      message_thread_id: number
    }
    expect(sent.chat_id).toBe('-100999')
    expect(sent.message_thread_id).toBe(42)
  })

  it('uses body token when provided', async () => {
    const fetchMock = vi.fn(async () => Response.json({ ok: true }))
    vi.stubGlobal('fetch', fetchMock)

    await app.inject({
      method: 'POST',
      url: '/api/settings/telegram/test',
      payload: {
        telegramBotToken: 'override-token',
        telegramChatId: '-1001',
      },
    })

    const url = String((fetchMock.mock.calls[0] as [string])[0])
    expect(url).toContain('botoverride-token/')
  })
})
