import { describe, expect, it } from 'vitest'

import {
  aggregateDashboardExpensesByMonthYear,
  aggregatePaymentsByMonthYear,
  isExpensePayment,
} from './chart-analytics'
import type { Payment, Settings, Vps } from '@/types/entities'

const settings: Settings[] = [{ id: 's1', baseCurrency: 'RUB' }]

const activeVps: Vps = {
  id: 'v1',
  ip: '1.2.3.4',
  providerId: 'pr1',
  providerAccountId: 'a1',
  vcpu: 1,
  ramGb: 1,
  diskGb: 10,
  status: 'active',
  tariffType: 'monthly',
  currency: 'RUB',
  dailyRate: null,
  monthlyRate: 1500,
  createdAt: '2026-01-01',
}

describe('chart-analytics', () => {
  it('treats topups as income, not expense', () => {
    expect(isExpensePayment('provider_balance_topup')).toBe(false)
    expect(isExpensePayment('direct_vps_payment')).toBe(true)
  })

  it('aggregates topups only in payments chart', () => {
    const payments: Payment[] = [
      {
        id: 'p1',
        type: 'provider_balance_topup',
        date: '2026-03-15',
        amount: 1000,
        currency: 'RUB',
        providerAccountId: 'a1',
        vpsId: null,
        note: '',
      },
    ]

    const all = aggregatePaymentsByMonthYear(payments, 2026, settings, null, 'all')
    const expenseOnly = aggregatePaymentsByMonthYear(payments, 2026, settings, null, 'expense')

    expect(all[2]?.amount).toBe(1000)
    expect(expenseOnly[2]?.amount).toBe(0)
  })

  it('falls back to VPS burn estimate for current month only when no expense records', () => {
    const payments: Payment[] = [
      {
        id: 'p1',
        type: 'provider_balance_topup',
        date: '2026-03-15',
        amount: 1000,
        currency: 'RUB',
        providerAccountId: 'a1',
        vpsId: null,
        note: '',
      },
    ]

    const { rows, mode } = aggregateDashboardExpensesByMonthYear(
      payments,
      [],
      [activeVps],
      [],
      new Date().getFullYear(),
      settings,
      null,
    )

    expect(mode).toBe('estimate')
    const currentMonth = new Date().getMonth()
    expect(rows[currentMonth]?.amount).toBe(1500)
    for (let i = 0; i < 12; i++) {
      if (i === currentMonth) continue
      expect(rows[i]?.amount).toBe(0)
    }
  })

  it('uses actual expense payments when present', () => {
    const payments: Payment[] = [
      {
        id: 'p1',
        type: 'direct_vps_payment',
        date: '2026-02-10',
        amount: 2000,
        currency: 'RUB',
        providerAccountId: 'a1',
        vpsId: 'v1',
        note: '',
      },
    ]

    const { rows, mode } = aggregateDashboardExpensesByMonthYear(
      payments,
      [],
      [activeVps],
      [],
      2026,
      settings,
      null,
    )

    expect(mode).toBe('actual')
    expect(rows[1]?.amount).toBe(2000)
    expect(rows[2]?.amount).toBe(0)
  })
})
