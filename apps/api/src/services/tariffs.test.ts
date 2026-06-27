import { describe, expect, it } from 'vitest'
import { parseTariffPrice } from '@cfdm/db/repositories/tariffs'

describe('parseTariffPrice', () => {
  it('parses amount and currency', () => {
    expect(parseTariffPrice('100.50 RUB')).toEqual({ monthlyRate: 100.5, currency: 'RUB' })
    expect(parseTariffPrice('12 USD')).toEqual({ monthlyRate: 12, currency: 'USD' })
  })

  it('handles empty', () => {
    expect(parseTariffPrice('')).toEqual({ monthlyRate: null, currency: null })
  })
})
