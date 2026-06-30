import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { closeDb } from '@cfdm/db'
import { settingsRepository } from '@cfdm/db/repositories/settings'
import { resetTestDb } from '@cfdm/db/test-setup'
import { buildApp } from '../index.js'

describe('integrations CFDM routes', () => {
  let app: Awaited<ReturnType<typeof buildApp>>

  beforeEach(async () => {
    resetTestDb()
    app = await buildApp()
  })

  afterEach(async () => {
    await app.close()
    closeDb()
  })

  it('отклоняет запрос без токена', async () => {
    settingsRepository.upsert('settings-main', {
      integrationToken: 'test-secret',
      integrationEnabled: true,
    })
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/integrations/cfdm/ping',
    })
    expect(res.statusCode).toBe(401)
  })

  it('принимает ping с верным Bearer', async () => {
    settingsRepository.upsert('settings-main', {
      integrationToken: 'test-secret',
      integrationEnabled: true,
    })
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/integrations/cfdm/ping',
      headers: { authorization: 'Bearer test-secret' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ ok: true, service: 'vps-tracker' })
  })
})
