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
      vi.fn<typeof fetch>(async () =>
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
    const fetchMock = vi.fn<typeof fetch>(async () => Response.json({ ok: true }))
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

    const call = fetchMock.mock.calls[0]
    expect(call).toBeDefined()
    const sent = JSON.parse(String(call![1]?.body)) as {
      chat_id: string
      message_thread_id: number
    }
    expect(sent.chat_id).toBe('-100999')
    expect(sent.message_thread_id).toBe(42)
  })

  it('uses body token when provided', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => Response.json({ ok: true }))
    vi.stubGlobal('fetch', fetchMock)

    await app.inject({
      method: 'POST',
      url: '/api/settings/telegram/test',
      payload: {
        telegramBotToken: 'override-token',
        telegramChatId: '-1001',
      },
    })

    const url = String(fetchMock.mock.calls[0]![0])
    expect(url).toContain('botoverride-token/')
  })
})

describe('settings cfdm sync', () => {
  let app: Awaited<ReturnType<typeof buildApp>>

  beforeEach(async () => {
    resetTestDb()
    settingsRepository.upsert('settings-main', {
      integrationEnabled: true,
      integrationToken: 'shared-token',
      cfdmApiUrl: 'http://cfdm.test',
    })
    app = await buildApp()
  })

  afterEach(async () => {
    await app.close()
    vi.unstubAllGlobals()
    closeDb()
  })

  it('persists cfdmApiUrl via PUT settings', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/settings/settings-main',
      payload: { cfdmApiUrl: 'http://192.168.100.67:6363' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ cfdmApiUrl: 'http://192.168.100.67:6363' })

    const dto = settingsRepository.get('settings-main')
    expect(dto?.cfdmApiUrl).toBe('http://192.168.100.67:6363')
  })

  it('requests full sync from CFDM', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      Response.json({
        ok: true,
        count: 1,
        fullSync: true,
        bindings: [
          {
            bindingId: 1,
            serviceId: 10,
            serviceName: 'web',
            serviceSlug: 'web',
            fqdn: 'app.example.com',
            zoneName: 'example.com',
            hostname: 'app',
            ips: ['1.2.3.4'],
          },
        ],
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const res = await app.inject({ method: 'POST', url: '/api/settings/cfdm/sync' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ ok: true })
    expect((res.json() as { count: number }).count).toBeGreaterThanOrEqual(1)

    const call = fetchMock.mock.calls[0]
    expect(call?.[0]).toBe('http://cfdm.test/api/v1/integrations/vps-tracker/sync')
    expect((call?.[1]?.headers as Record<string, string>).Authorization).toBe(
      'Bearer shared-token',
    )
  })

  it('works with saved token even when accept toggle is off', async () => {
    settingsRepository.upsert('settings-main', {
      integrationEnabled: false,
      integrationToken: 'shared-token',
      cfdmApiUrl: 'http://cfdm.test',
    })
    const fetchMock = vi.fn<typeof fetch>(async () =>
      Response.json({ ok: true, count: 0, bindings: [], fullSync: true }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const res = await app.inject({ method: 'POST', url: '/api/settings/cfdm/sync' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ ok: true, count: 0 })
    expect(fetchMock).toHaveBeenCalled()
  })

  it('returns clear error when CFDM is unreachable', async () => {
    settingsRepository.upsert('settings-main', {
      integrationEnabled: true,
      integrationToken: 'shared-token',
      cfdmApiUrl: 'http://cfdm.test',
    })
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(async () => {
        throw new TypeError('fetch failed')
      }),
    )

    const res = await app.inject({ method: 'POST', url: '/api/settings/cfdm/sync' })
    expect(res.statusCode).toBe(502)
    const body = res.json() as { ok: boolean; error: string }
    expect(body.ok).toBe(false)
    expect(body.error).toContain('http://cfdm.test')
    expect(body.error).toContain('fetch failed')
  })

  it('returns error when CFDM URL is missing', async () => {
    settingsRepository.upsert('settings-main', {
      integrationEnabled: true,
      integrationToken: 'shared-token',
      cfdmApiUrl: '',
    })
    const res = await app.inject({ method: 'POST', url: '/api/settings/cfdm/sync' })
    expect(res.statusCode).toBe(502)
    const body = res.json() as { ok: boolean; error: string }
    expect(body.ok).toBe(false)
    expect(body.error).toContain('URL API CFDM')
  })

  it('uses only saved cfdmApiUrl, not App Switcher defaults', async () => {
    settingsRepository.upsert('settings-main', {
      integrationEnabled: true,
      integrationToken: 'shared-token',
      cfdmApiUrl: 'https://cfdm.prod.example',
      appSwitcher: {
        menuLabel: 'Apps',
        apps: [
          {
            id: 'cfdm',
            name: 'CFDM',
            url: 'http://192.168.100.67:6363',
            icon: 'cloud',
          },
        ],
      },
    })
    const fetchMock = vi.fn<typeof fetch>(async () =>
      Response.json({ ok: true, count: 0, bindings: [], fullSync: true }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const res = await app.inject({ method: 'POST', url: '/api/settings/cfdm/sync' })
    expect(res.statusCode).toBe(200)
    const call = fetchMock.mock.calls[0]
    expect(call?.[0]).toBe('https://cfdm.prod.example/api/v1/integrations/vps-tracker/sync')
  })
})
