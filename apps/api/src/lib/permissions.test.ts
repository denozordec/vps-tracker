import { describe, expect, it } from 'vitest'
import {
  hasPermission,
  permissionForRequest,
} from '../lib/permissions.js'

describe('hasPermission hierarchy', () => {
  it('grants read via write/admin', () => {
    expect(hasPermission(['vps:vps:write'], 'vps:vps:read')).toBe(true)
    expect(hasPermission(['vps:vps:admin'], 'vps:vps:read')).toBe(true)
    expect(hasPermission(['vps:vps:admin'], 'vps:vps:write')).toBe(true)
  })

  it('denies missing section', () => {
    expect(hasPermission(['vps:vps:read'], 'vps:settings:admin')).toBe(false)
    expect(hasPermission(['vps:vps:read'], 'vps:vps:write')).toBe(false)
  })
})

describe('permissionForRequest', () => {
  it('maps vps CRUD', () => {
    expect(permissionForRequest('GET', '/api/vps')).toBe('vps:vps:read')
    expect(permissionForRequest('POST', '/api/vps')).toBe('vps:vps:write')
    expect(permissionForRequest('DELETE', '/api/vps/abc')).toBe('vps:vps:write')
  })

  it('maps sync and settings', () => {
    expect(permissionForRequest('POST', '/api/sync/acc-1')).toBe('vps:sync:write')
    expect(permissionForRequest('GET', '/api/settings')).toBe('vps:settings:admin')
  })
})
