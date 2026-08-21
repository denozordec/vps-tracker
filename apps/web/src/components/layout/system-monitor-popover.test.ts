import { describe, expect, it } from 'vitest'

import { countRecentFailedNotifications } from './system-monitor-popover'

const HOUR = 60 * 60 * 1000
const now = Date.parse('2026-08-22T00:00:00.000Z')

describe('countRecentFailedNotifications', () => {
  it('counts only failed rows within the window', () => {
    const rows = [
      { status: 'failed', createdAt: new Date(now - 2 * HOUR).toISOString() },
      { status: 'sent', createdAt: new Date(now - 1 * HOUR).toISOString() },
      { status: 'failed', createdAt: new Date(now - 30 * HOUR).toISOString() },
    ]
    expect(countRecentFailedNotifications(rows, 24 * HOUR, now)).toBe(1)
  })

  it('ignores rows without a valid createdAt', () => {
    expect(
      countRecentFailedNotifications(
        [{ status: 'failed', createdAt: null }, { status: 'failed' }],
        24 * HOUR,
        now,
      ),
    ).toBe(0)
  })
})
