import { describe, expect, it } from 'vitest'
import {
  vpsTariffComparableDailyRate,
  vpsTariffMonthlyBurn,
  vpsTariffRateAmount,
} from './format'

describe('vpsTariffComparableDailyRate', () => {
  it('нормализует месячный тариф к суточной стоимости', () => {
    expect(
      vpsTariffComparableDailyRate({
        tariffType: 'monthly',
        monthlyRate: 75,
        dailyRate: null,
      }),
    ).toBeCloseTo(75 / 30, 6)
  })

  it('оставляет суточный тариф как есть', () => {
    expect(
      vpsTariffComparableDailyRate({
        tariffType: 'daily',
        dailyRate: 5.59,
        monthlyRate: 167.7,
      }),
    ).toBeCloseTo(5.59, 6)
  })

  it('сортирует 5,59/сутки дороже 75/мес', () => {
    const daily = vpsTariffComparableDailyRate({
      tariffType: 'daily',
      dailyRate: 5.59,
    })
    const monthly = vpsTariffComparableDailyRate({
      tariffType: 'monthly',
      monthlyRate: 75,
    })
    expect(daily).toBeGreaterThan(monthly)
  })

  it('для daily без dailyRate берёт monthly/30', () => {
    expect(
      vpsTariffComparableDailyRate({
        tariffType: 'daily',
        dailyRate: 0,
        monthlyRate: 90,
      }),
    ).toBeCloseTo(3, 6)
  })
})

describe('vpsTariffMonthlyBurn', () => {
  it('даёт месячный эквивалент суточного тарифа', () => {
    expect(
      vpsTariffMonthlyBurn({ tariffType: 'daily', dailyRate: 5.59 }),
    ).toBeCloseTo(5.59 * 30, 6)
  })

  it('для месячного возвращает monthlyRate', () => {
    expect(
      vpsTariffMonthlyBurn({ tariffType: 'monthly', monthlyRate: 75 }),
    ).toBeCloseTo(75, 6)
  })
})

describe('vpsTariffRateAmount', () => {
  it('для отображения берёт ставку периода без нормализации', () => {
    expect(
      vpsTariffRateAmount({ tariffType: 'daily', dailyRate: 5.59, monthlyRate: 167 }),
    ).toBe(5.59)
    expect(
      vpsTariffRateAmount({ tariffType: 'monthly', monthlyRate: 75, dailyRate: 2.5 }),
    ).toBe(75)
  })
})
