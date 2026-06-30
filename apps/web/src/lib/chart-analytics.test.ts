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

  it('falls back to VPS burn estimate when no expense records exist', () => {
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
      2026,
      settings,
      null,
    )

    expect(mode).toBe('estimate')
    expect(rows[2]?.amount).toBe(1500)
  })
})
