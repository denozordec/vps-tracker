import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { closeDb } from '@cfdm/db'
import { settingsRepository } from '@cfdm/db/repositories/settings'
import { resetTestDb } from '@cfdm/db/test-setup'

vi.mock('./cfdm-sync.js', () => ({
  requestCfdmFullSync: vi.fn(),
}))

import { requestCfdmFullSync } from './cfdm-sync.js'
import { runScheduledCfdmSync } from './scheduler.js'

const pullMock = vi.mocked(requestCfdmFullSync)

describe('runScheduledCfdmSync', () => {
  beforeEach(async () => {
    await resetTestDb()
    pullMock.mockReset()
    pullMock.mockResolvedValue({ ok: true, count: 3 })
  })

  afterEach(async () => {
    await closeDb()
  })

  it('pulls CFDM when integration is enabled with url and token', async () => {
    settingsRepository.upsertForSpace('space-main', {
      integrationEnabled: true,
      integrationToken: 'tok-sched-cfdm',
      cfdmApiUrl: 'http://cfdm.test',
    })

    await runScheduledCfdmSync()

    expect(pullMock).toHaveBeenCalledTimes(1)
  })

  it('skips when integration is disabled', async () => {
    settingsRepository.upsertForSpace('space-main', {
      integrationEnabled: false,
      integrationToken: 'tok-sched-cfdm',
      cfdmApiUrl: 'http://cfdm.test',
    })

    await runScheduledCfdmSync()

    expect(pullMock).not.toHaveBeenCalled()
  })
})
