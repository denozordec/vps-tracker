import { afterEach, describe, expect, it, vi } from 'vitest'

import { fourvpsRequest, FourVpsApiError } from './client.js'

describe('fourvpsRequest', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('sends Bearer auth and panel_id query param', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ error: false, data: { userBalance: 100 } }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const data = await fourvpsRequest('https://4vps.su/api', 'test-key', '/userBalance', {
      panelId: 2,
    })

    expect(data).toEqual({ userBalance: 100 })
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('panel_id=2')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer test-key')
  })

  it('throws FourVpsApiError on API error flag', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          error: true,
          errorMessage: 'Authentication error',
          data: false,
        }),
      }),
    )

    await expect(fourvpsRequest('https://4vps.su/api', 'bad', '/userBalance')).rejects.toThrow(
      FourVpsApiError,
    )
  })
})
