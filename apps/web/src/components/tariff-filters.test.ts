import { describe, expect, it } from 'vitest'

import {
  applyTariffFilters,
  buildDefaultTariffFilters,
  hasActiveTariffFilters,
  hasTariffZeroResults,
} from '@/components/tariff-filters'
import type { ActiveTariff, ProviderAccount } from '@/types/entities'

const accounts: ProviderAccount[] = [
  {
    id: 'acc-1',
    providerId: 'prov-1',
    name: 'Account 1',
  },
]

const ctx = { providerAccounts: accounts }

const baseTariff = (overrides: Partial<ActiveTariff> = {}): ActiveTariff => ({
  id: 't-1',
  providerAccountId: 'acc-1',
  providerId: 'prov-1',
  name: 'Basic VPS',
  vcpu: 2,
  ramGb: 4,
  diskGb: 40,
  diskType: 'SSD',
  monthlyRate: 500,
  currency: 'RUB',
  location: 'Moscow',
  country: 'Россия',
  datacenterName: 'MSK-1',
  ...overrides,
})

describe('applyTariffFilters', () => {
  it('скрывает нулевые цены по умолчанию', () => {
    const items = [
      baseTariff({ id: 't-paid', monthlyRate: 100 }),
      baseTariff({ id: 't-zero', monthlyRate: 0 }),
      baseTariff({ id: 't-null', monthlyRate: undefined }),
    ]
    const filters = buildDefaultTariffFilters()
    const result = applyTariffFilters(items, filters, ctx)
    expect(result.map((t) => t.id)).toEqual(['t-paid'])
  })

  it('показывает нулевые цены когда hideZeroPrice выключен', () => {
    const items = [
      baseTariff({ id: 't-paid', monthlyRate: 100 }),
      baseTariff({ id: 't-zero', monthlyRate: 0 }),
    ]
    const filters = { ...buildDefaultTariffFilters(), hideZeroPrice: false }
    const result = applyTariffFilters(items, filters, ctx)
    expect(result.map((t) => t.id)).toEqual(['t-paid', 't-zero'])
  })

  it('фильтрует по поиску в названии', () => {
    const items = [
      baseTariff({ id: 't-1', name: 'Premium VPS' }),
      baseTariff({ id: 't-2', name: 'Basic VPS' }),
    ]
    const filters = { ...buildDefaultTariffFilters(), search: 'premium', hideZeroPrice: false }
    const result = applyTariffFilters(items, filters, ctx)
    expect(result.map((t) => t.id)).toEqual(['t-1'])
  })

  it('фильтрует по providerId через providerAccountId', () => {
    const items = [
      baseTariff({ id: 't-1', providerId: 'prov-1', providerAccountId: 'acc-1' }),
      baseTariff({ id: 't-2', providerId: 'prov-2', providerAccountId: 'acc-2' }),
    ]
    const filters = {
      ...buildDefaultTariffFilters(),
      providerId: ['prov-2'],
      hideZeroPrice: false,
    }
    const result = applyTariffFilters(items, filters, ctx)
    expect(result.map((t) => t.id)).toEqual(['t-2'])
  })

  it('фильтрует по диапазону цены', () => {
    const items = [
      baseTariff({ id: 't-low', monthlyRate: 100 }),
      baseTariff({ id: 't-mid', monthlyRate: 500 }),
      baseTariff({ id: 't-high', monthlyRate: 1000 }),
    ]
    const filters = {
      ...buildDefaultTariffFilters(),
      minPrice: 200,
      maxPrice: 800,
      hideZeroPrice: false,
    }
    const result = applyTariffFilters(items, filters, ctx)
    expect(result.map((t) => t.id)).toEqual(['t-mid'])
  })
})

describe('hasActiveTariffFilters', () => {
  it('не считает hideZeroPrice=true активным отклонением', () => {
    expect(hasActiveTariffFilters(buildDefaultTariffFilters())).toBe(false)
  })

  it('считает hideZeroPrice=false активным отклонением', () => {
    expect(hasActiveTariffFilters({ ...buildDefaultTariffFilters(), hideZeroPrice: false })).toBe(true)
  })
})

describe('hasTariffZeroResults', () => {
  it('true когда все отфильтрованы нулевыми ценами', () => {
    expect(hasTariffZeroResults(buildDefaultTariffFilters(), 5, 0)).toBe(true)
  })

  it('false когда нет данных', () => {
    expect(hasTariffZeroResults(buildDefaultTariffFilters(), 0, 0)).toBe(false)
  })
})
