import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { closeDb } from '@cfdm/db'
import { resetTestDb } from '@cfdm/db/test-setup'

vi.mock('./uptime-check.js', () => ({ runVpsUptimeChecks: vi.fn() }))

import { runVpsUptimeChecks } from './uptime-check.js'
import { resetSchedulerState, runScheduledUptimeChecks } from './scheduler.js'

const uptimeMock = vi.mocked(runVpsUptimeChecks)

describe('scheduler guards', () => {
  beforeEach(() => {
    resetTestDb()
    resetSchedulerState()
    uptimeMock.mockReset()
  })
  afterEach(() => closeDb())

  it('skips a tick while the previous one runs and respects the space interval', async () => {
    let finish!: () => void
    uptimeMock.mockImplementation(
      () => new Promise((resolve) => (finish = () => resolve({ checked: 0, down: 0, newlyDown: [], newlyUp: [] }))),
    )
    const first = runScheduledUptimeChecks()
    await runScheduledUptimeChecks() // overlapping tick → skipped
    await vi.waitFor(() => expect(finish).toBeTypeOf('function'))
    finish()
    await first
    expect(uptimeMock).toHaveBeenCalledTimes(1)

    uptimeMock.mockResolvedValue({ checked: 0, down: 0, newlyDown: [], newlyUp: [] })
    await runScheduledUptimeChecks() // space interval (5 min) not elapsed
    expect(uptimeMock).toHaveBeenCalledTimes(1)

    resetSchedulerState()
    await runScheduledUptimeChecks()
    expect(uptimeMock).toHaveBeenCalledTimes(2)
  })
})
