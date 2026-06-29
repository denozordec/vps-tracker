import { describe, expect, it } from 'vitest'

import { inferPlanPeriod, normalizePlanPeriod } from './operations.js'

describe('normalizePlanPeriod', () => {
  it('detects day and month from period and period_name', () => {
    expect(normalizePlanPeriod('day')).toBe('day')
    expect(normalizePlanPeriod('month')).toBe('month')
    expect(normalizePlanPeriod(undefined, 'день')).toBe('day')
    expect(normalizePlanPeriod(undefined, 'месяц')).toBe('month')
  })

  it('returns null when period is unknown', () => {
    expect(normalizePlanPeriod()).toBeNull()
    expect(normalizePlanPeriod('', '')).toBeNull()
  })
})

describe('inferPlanPeriod', () => {
  it('defaults macloud to month when plan has no period', () => {
    expect(inferPlanPeriod({ id: 1, name: 'x', cost: 150 }, 'macloud')).toBe('month')
  })

  it('defaults vdsina to day when plan has no period', () => {
    expect(inferPlanPeriod({ id: 1, name: 'x', cost: 2.1 }, 'vdsina')).toBe('day')
  })

  it('respects explicit plan period over apiType default', () => {
    expect(
      inferPlanPeriod({ id: 1, name: 'x', cost: 2.1, period: 'day' }, 'macloud'),
    ).toBe('day')
  })

  it('uses account billingMode when plan period is missing', () => {
    expect(inferPlanPeriod({ id: 1, name: 'x', cost: 90 }, 'vdsina', 'monthly')).toBe('month')
  })
})
