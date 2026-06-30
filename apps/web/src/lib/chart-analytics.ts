import type { Payment, Settings, RatesData } from '@/types/entities'
import { canonicalPaymentType, convertCurrency, monthKey, toIsoCurrency } from '@/lib/format'

export const EXPENSE_PAYMENT_TYPES = new Set([
  'direct_vps_payment',
  'daily_debit',
  'monthly_debit',
])

const MONTH_SHORT_RU = [
  'янв',
  'фев',
  'мар',
  'апр',
  'май',
  'июн',
  'июл',
  'авг',
  'сен',
  'окт',
  'ноя',
  'дек',
] as const

export type PaymentChartFilter = 'all' | 'expense'

export function formatMonthShortRu(monthIndex: number): string {
  return MONTH_SHORT_RU[monthIndex] ?? ''
}

export function isExpensePayment(type: string): boolean {
  return EXPENSE_PAYMENT_TYPES.has(canonicalPaymentType(type))
}

export function availablePaymentYears(payments: Payment[]): number[] {
  const years = new Set<number>()
  for (const p of payments) {
    const key = monthKey(p.date)
    if (!key) continue
    const year = Number(key.slice(0, 4))
    if (Number.isFinite(year)) years.add(year)
  }
  years.add(new Date().getFullYear())
  return Array.from(years).sort((a, b) => b - a)
}

export function aggregatePaymentsByMonthYear(
  payments: Payment[],
  year: number,
  settings: Settings[],
  ratesData: RatesData | null,
  filter: PaymentChartFilter = 'all',
): { month: string; amount: number }[] {
  const baseCurrency = (settings[0]?.baseCurrency ?? 'RUB').toUpperCase()
  const byMonth = Array.from({ length: 12 }, () => 0)

  for (const p of payments) {
    if (filter === 'expense' && !isExpensePayment(p.type)) continue
    const date = new Date(p.date)
    if (Number.isNaN(date.getTime()) || date.getFullYear() !== year) continue
    const converted = convertCurrency(
      Number(p.amount),
      toIsoCurrency(p.currency),
      baseCurrency,
      ratesData,
    )
    byMonth[date.getMonth()]! += converted
  }

  return byMonth.map((amount, index) => ({
    month: formatMonthShortRu(index),
    amount: Math.round(amount),
  }))
}
