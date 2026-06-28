import { describe, expect, it } from 'vitest'
import { parseTariffPrice } from '@cfdm/db/repositories/tariffs'

describe('parseTariffPrice', () => {
  it('parses BILLmanager monthly amount and currency', () => {
    expect(parseTariffPrice('100.50 RUB')).toEqual({
      amount: 100.5,
      monthlyRate: 100.5,
      currency: 'RUB',
      period: 'month',
    })
    expect(parseTariffPrice('12 USD')).toEqual({
      amount: 12,
      monthlyRate: 12,
      currency: 'USD',
      period: 'month',
    })
  })

  it('parses UserAPI daily formats', () => {
    expect(parseTariffPrice('1.55 USD/day')).toEqual({
      amount: 1.55,
      monthlyRate: 46.5,
      currency: 'USD',
      period: 'day',
    })
    expect(parseTariffPrice('1.55 ₽/день')).toEqual({
      amount: 1.55,
      monthlyRate: 46.5,
      currency: 'RUB',
      period: 'day',
    })
  })

  it('handles empty', () => {
    expect(parseTariffPrice('')).toEqual({
      amount: null,
      monthlyRate: null,
      currency: null,
      period: null,
    })
  })
})
