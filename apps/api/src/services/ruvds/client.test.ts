import { afterEach, describe, expect, it, vi } from 'vitest'

import { RuvdsClient } from './client.js'

describe('RuvdsClient', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('sends Bearer authorization header', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ amount: 100, currency: 1 }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const client = new RuvdsClient('https://api.ruvds.com', 'test-token')
    await client.request('/v2/balance')

    expect(fetchMock).toHaveBeenCalledOnce()
    const init = fetchMock.mock.calls[0][1] as RequestInit
    expect(init.headers).toMatchObject({
      Authorization: 'Bearer test-token',
      Accept: 'application/json',
    })
  })

  it('throws on 401 with message from API', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ id: 'unauthorized', message: 'Invalid token' }),
      }),
    )

    const client = new RuvdsClient('https://api.ruvds.com', 'bad-token')
    await expect(client.request('/v2/balance')).rejects.toThrow('Invalid token')
  })
})
