import { afterEach, describe, expect, it, vi } from 'vitest'

import { VeespClient, parseVeespCredentials, veespLogin } from './client.js'

describe('parseVeespCredentials', () => {
  it('parses email:password', () => {
    expect(parseVeespCredentials('user@example.com:secret')).toEqual({
      username: 'user@example.com',
      password: 'secret',
    })
  })

  it('throws when format invalid', () => {
    expect(() => parseVeespCredentials('token-only')).toThrow(/email:password/)
  })
})

describe('veespLogin', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns token from login response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ token: 'jwt-token' }),
      }),
    )

    const token = await veespLogin('https://secure.veesp.com/api', {
      username: 'user@example.com',
      password: 'secret',
    })
    expect(token).toBe('jwt-token')
    const [, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit]
    expect(JSON.parse(String(init.body))).toEqual({
      username: 'user@example.com',
      password: 'secret',
    })
  })
})

describe('VeespClient.request', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('uses Bearer token after login', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ token: 'jwt-token' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ services: [] }),
      })
    vi.stubGlobal('fetch', fetchMock)

    const client = new VeespClient('https://secure.veesp.com/api', {
      username: 'user@example.com',
      password: 'secret',
    })
    const data = await client.request<{ services: unknown[] }>('/service')

    expect(data.services).toEqual([])
    const [, init] = fetchMock.mock.calls[1] as [string, RequestInit]
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer jwt-token')
  })

  it('throws VeespApiError on HTTP error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ message: 'Unauthorized' }),
      }),
    )

    const client = new VeespClient('https://secure.veesp.com/api', {
      username: 'user@example.com',
      password: 'bad',
    })

    await expect(client.request('/service')).rejects.toThrow('Unauthorized')
  })
})
