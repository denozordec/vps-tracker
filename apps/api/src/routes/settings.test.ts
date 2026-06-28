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
      telegramBotToken: 'token',
      telegramChatId: '123',
    })
    app = await buildApp()
  })

  afterEach(async () => {
    await app.close()
    vi.unstubAllGlobals()
    closeDb()
  })

  it('returns telegram API error', async () => {
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
  })
})
