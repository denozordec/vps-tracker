import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { closeDb } from '@cfdm/db'
import { resetTestDb, seedTestProvider } from '@cfdm/db/test-setup'
import { providerAccountsRepository } from '@cfdm/db/repositories/provider-accounts'
import { buildApp } from '../index.js'
import { getSqlite } from '@cfdm/db'

describe('provider-accounts routes', () => {
  let app: Awaited<ReturnType<typeof buildApp>>

  beforeEach(async () => {
    resetTestDb()
    seedTestProvider()
    app = await buildApp()
  })

  afterEach(async () => {
    await app.close()
    closeDb()
  })

  it('creates account and returns apiLogin', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/provider-accounts',
      payload: {
        providerId: 'prov-1',
        name: 'Primary',
        apiCredentials: 'login:password',
        billingMode: 'monthly',
      },
    })
    expect(res.statusCode).toBe(201)
    const body = res.json() as { apiLogin?: string; apiCredentialsSet?: boolean }
    expect(body.apiLogin).toBe('login')
    expect(body.apiCredentialsSet).toBe(true)
  })

  it('returns 409 when deleting account with VPS', async () => {
    providerAccountsRepository.create({
      id: 'acc-del',
      providerId: 'prov-1',
      name: 'Bound',
    })
    getSqlite()
      .prepare(
        `INSERT INTO vps (id, ip, providerId, providerAccountId, status) VALUES ('vps-x', '2.2.2.2', 'prov-1', 'acc-del', 'active')`,
      )
      .run()

    const res = await app.inject({
      method: 'DELETE',
      url: '/api/provider-accounts/acc-del',
    })
    expect(res.statusCode).toBe(409)
    const body = res.json() as { error?: { code?: string; dependencies?: { vps?: number } } }
    expect(body.error?.code).toBe('CONFLICT')
    expect(body.error?.dependencies?.vps).toBe(1)
  })

  it('deletes account without dependencies', async () => {
    providerAccountsRepository.create({
      id: 'acc-free',
      providerId: 'prov-1',
      name: 'Free',
    })
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/provider-accounts/acc-free',
    })
    expect(res.statusCode).toBe(204)
    expect(providerAccountsRepository.get('acc-free')).toBeUndefined()
  })
})
