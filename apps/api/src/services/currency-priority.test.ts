import { describe, expect, it } from 'vitest'
import { resolveProviderCurrency } from '@cfdm/shared/utils/currency'
import { effectiveAccountBalanceCurrency } from '@cfdm/shared/utils/account-balance'

describe('resolveProviderCurrency', () => {
  it('prefers account currency over provider baseCurrency', () => {
    expect(resolveProviderCurrency({ baseCurrency: 'EUR' }, 'USD')).toBe('USD')
  })

  it('falls back to provider when account currency is empty', () => {
    expect(resolveProviderCurrency({ baseCurrency: 'EUR' }, '')).toBe('EUR')
  })
})

describe('effectiveAccountBalanceCurrency', () => {
  it('uses account currency for balance display', () => {
    expect(
      effectiveAccountBalanceCurrency({ currency: 'USD', balance_currency: 'EUR' }, { baseCurrency: 'EUR' }),
    ).toBe('USD')
  })
})
