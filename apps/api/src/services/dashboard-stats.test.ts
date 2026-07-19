import { describe, expect, it } from 'vitest'

import { computeMinRunwayDays } from './dashboard-stats.js'

describe('computeMinRunwayDays', () => {
  const now = new Date('2026-07-20T12:00:00Z')
  const accounts = [{ id: 'acc-1', balanceApi: 0 }]
  const emptyExtra = { payments: [], balanceLedger: [] }

  it('prepaid: берёт ближайший paidUntil, игнорирует нулевой баланс', () => {
    const days = computeMinRunwayDays(
      [
        {
          id: 'v1',
          status: 'active',
          providerAccountId: 'acc-1',
          tariffType: 'monthly',
          monthlyRate: 500,
          paidUntil: '2026-08-21',
        },
        {
          id: 'v2',
          status: 'active',
          providerAccountId: 'acc-1',
          tariffType: 'monthly',
          monthlyRate: 300,
          paidUntil: '2026-09-01',
        },
      ],
      { providerAccounts: accounts, ...emptyExtra },
      now,
    )
    // 2026-07-20 → 2026-08-21 = 32 дня
    expect(days).toBe(32)
  })

  it('просроченный VPS → запас 0', () => {
    const days = computeMinRunwayDays(
      [
        {
          id: 'v1',
          status: 'active',
          providerAccountId: 'acc-1',
          tariffType: 'monthly',
          monthlyRate: 100,
          paidUntil: '2026-07-01',
        },
        {
          id: 'v2',
          status: 'active',
          providerAccountId: 'acc-1',
          tariffType: 'monthly',
          monthlyRate: 100,
          paidUntil: '2026-09-01',
        },
      ],
      { providerAccounts: accounts, ...emptyExtra },
      now,
    )
    expect(days).toBe(0)
  })

  it('daily: запас из баланса / burn, а не из нулевого paidUntil-логики', () => {
    const days = computeMinRunwayDays(
      [
        {
          id: 'v1',
          status: 'active',
          providerAccountId: 'acc-1',
          tariffType: 'daily',
          dailyRate: 10,
          paidUntil: '2026-07-21',
        },
      ],
      {
        providerAccounts: [{ id: 'acc-1', balanceApi: 100, billingMode: 'daily' }],
        ...emptyExtra,
      },
      now,
    )
    // 100 / 10 = 10 дней покрытия
    expect(days).toBe(10)
  })

  it('без активных с датой → null', () => {
    expect(
      computeMinRunwayDays(
        [{ id: 'v1', status: 'stopped', paidUntil: '2026-08-01' }],
        { providerAccounts: accounts, ...emptyExtra },
        now,
      ),
    ).toBeNull()
  })
})
