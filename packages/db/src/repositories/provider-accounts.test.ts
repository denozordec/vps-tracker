import { beforeEach, describe, expect, it } from 'vitest'
import { parseApiLogin } from '@cfdm/shared/utils/api-credentials'
import { providerAccountsRepository } from './provider-accounts.js'
import { resetTestDb, seedTestProvider } from '../test-setup.js'
import { getSqlite } from '../index.js'

describe('parseApiLogin', () => {
  it('extracts login before colon', () => {
    expect(parseApiLogin('user:secret')).toBe('user')
    expect(parseApiLogin('  admin:pass  ')).toBe('admin')
  })

  it('returns empty for invalid credentials', () => {
    expect(parseApiLogin('')).toBe('')
    expect(parseApiLogin('nocolon')).toBe('')
    expect(parseApiLogin(':onlypass')).toBe('')
  })
})

describe('providerAccountsRepository', () => {
  beforeEach(() => {
    resetTestDb()
    seedTestProvider()
  })

  it('returns apiLogin without exposing password', () => {
    const created = providerAccountsRepository.create({
      providerId: 'prov-1',
      name: 'Main',
      apiCredentials: 'apiuser:apipass',
    })
    expect(created.apiLogin).toBe('apiuser')
    expect(created.apiCredentialsSet).toBe(true)
    expect('apiCredentials' in created).toBe(false)
  })

  it('preserves credentials on update when apiCredentials empty', () => {
    providerAccountsRepository.create({
      id: 'acc-1',
      providerId: 'prov-1',
      name: 'Main',
      apiCredentials: 'keep:me',
    })
    const updated = providerAccountsRepository.update('acc-1', { name: 'Renamed', apiCredentials: '' })
    expect(updated?.name).toBe('Renamed')
    expect(updated?.apiLogin).toBe('keep')
  })

  it('counts dependencies before delete', () => {
    providerAccountsRepository.create({
      id: 'acc-1',
      providerId: 'prov-1',
      name: 'Main',
    })
    getSqlite()
      .prepare(`INSERT INTO vps (id, ip, providerId, providerAccountId, status) VALUES ('vps-1', '1.1.1.1', 'prov-1', 'acc-1', 'active')`)
      .run()
    const deps = providerAccountsRepository.getDependencyCounts('acc-1')
    expect(deps.vps).toBe(1)
    expect(deps.payments).toBe(0)
  })
})
