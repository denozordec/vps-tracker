import { afterEach, describe, expect, it, vi } from 'vitest'

import { userApiRequest, UserApiError } from './client.js'

describe('userApiRequest', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('sends Bearer auth and parses ok envelope', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'ok',
        status_msg: 'Balance information',
        data: { real: '105.00' },
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const data = await userApiRequest('https://userapi.macloud.ru/v1', 'test-token', '/account.balance')

    expect(data).toEqual({ real: '105.00' })
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://userapi.macloud.ru/v1/account.balance')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer test-token')
  })

  it('throws UserApiError on API error status', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          status: 'error',
          status_msg: 'Unauthorized',
          description: 'Incorrect token',
        }),
      }),
    )

    await expect(
      userApiRequest('https://userapi.vdsina.com/v1', 'bad', '/account'),
    ).rejects.toThrow(UserApiError)
  })

  it('throws UserApiError on HTTP error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({
          status: 'error',
          status_msg: 'Forbidden',
          description: 'The API requests limits were exceeded',
        }),
      }),
    )

    await expect(
      userApiRequest('https://userapi.macloud.ru/v1', 'token', '/server'),
    ).rejects.toThrow('Forbidden')
  })
})
