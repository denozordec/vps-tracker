import type {
  Payment,
  Settings,
  RatesData,
  Vps,
  Provider,
  BalanceLedgerRow,
} from '@/types/entities'
import {
  canonicalPaymentType,
  convertCurrency,
  convertVpsMonthlyBurnToBase,
  monthKey,
  toIsoCurrency,
} from '@/lib/format'
import { providerByIdMap } from '@/lib/billmanager'

const INCOME_PAYMENT_TYPES = new Set(['provider_balance_topup'])

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

export type DashboardExpenseChartMode = 'actual' | 'estimate'

export function formatMonthShortRu(monthIndex: number): string {
  return MONTH_SHORT_RU[monthIndex] ?? ''
}

export function isExpensePayment(type: string): boolean {
  return !INCOME_PAYMENT_TYPES.has(canonicalPaymentType(type))
}

function yearFromDateString(dateString: string): number | null {
  const key = monthKey(dateString)
  if (!key) return null
  const year = Number(key.slice(0, 4))
  return Number.isFinite(year) ? year : null
}

function monthBucketsFromPayments(
  payments: Payment[],
  year: number,
  settings: Settings[],
  ratesData: RatesData | null,
  includePayment: (type: string) => boolean,
): number[] {
  const baseCurrency = (settings[0]?.baseCurrency ?? 'RUB').toUpperCase()
  const byMonth = Array.from({ length: 12 }, () => 0)

  for (const p of payments) {
    if (!includePayment(p.type)) continue
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

  return byMonth
}

function monthBucketsFromLedgerDebits(
  balanceLedger: BalanceLedgerRow[],
  year: number,
  settings: Settings[],
  ratesData: RatesData | null,
): number[] {
  const baseCurrency = (settings[0]?.baseCurrency ?? 'RUB').toUpperCase()
  const byMonth = Array.from({ length: 12 }, () => 0)

  for (const row of balanceLedger) {
    if (row.direction !== 'debit') continue
    const date = new Date(row.date)
    if (Number.isNaN(date.getTime()) || date.getFullYear() !== year) continue
    const converted = convertCurrency(
      Number(row.amount),
      toIsoCurrency(row.currency ?? baseCurrency),
      baseCurrency,
      ratesData,
    )
    byMonth[date.getMonth()]! += converted
  }

  return byMonth
}

function mergeMonthBuckets(...sources: number[][]): number[] {
  return Array.from({ length: 12 }, (_, index) =>
    sources.reduce((sum, buckets) => sum + (buckets[index] ?? 0), 0),
  )
}

function bucketsToRows(buckets: number[]): { month: string; amount: number }[] {
  return buckets.map((amount, index) => ({
    month: formatMonthShortRu(index),
    amount: Math.round(amount),
  }))
}

export function availablePaymentYears(payments: Payment[]): number[] {
  const years = new Set<number>()
  for (const p of payments) {
    const year = yearFromDateString(p.date)
    if (year != null) years.add(year)
  }
  years.add(new Date().getFullYear())
  return Array.from(years).sort((a, b) => b - a)
}

export function availableExpenseYears(
  payments: Payment[],
  balanceLedger: BalanceLedgerRow[],
): number[] {
  const years = new Set<number>()

  for (const p of payments) {
    if (!isExpensePayment(p.type)) continue
    const year = yearFromDateString(p.date)
    if (year != null) years.add(year)
  }

  for (const row of balanceLedger) {
    if (row.direction !== 'debit') continue
    const year = yearFromDateString(row.date)
    if (year != null) years.add(year)
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
  const includePayment = filter === 'expense' ? isExpensePayment : () => true
  return bucketsToRows(
    monthBucketsFromPayments(payments, year, settings, ratesData, includePayment),
  )
}

export function aggregateEstimatedVpsBurnByMonthYear(
  vps: Vps[],
  providers: Provider[],
  year: number,
  settings: Settings[],
  ratesData: RatesData | null,
): { month: string; amount: number }[] {
  const providerById = providerByIdMap(providers)
  const now = new Date()
  const byMonth = Array.from({ length: 12 }, () => 0)

  // Без факта списаний не выдумываем историю: оценка = текущий burn только в текущем месяце.
  if (year !== now.getFullYear()) {
    return bucketsToRows(byMonth)
  }

  const monthlyBurn = vps
    .filter((item) => item.status === 'active')
    .reduce(
      (sum, item) =>
        sum +
        convertVpsMonthlyBurnToBase(item, providerById.get(item.providerId), settings, ratesData),
      0,
    )

  byMonth[now.getMonth()] = monthlyBurn
  return bucketsToRows(byMonth)
}

export function aggregateDashboardExpensesByMonthYear(
  payments: Payment[],
  balanceLedger: BalanceLedgerRow[],
  vps: Vps[],
  providers: Provider[],
  year: number,
  settings: Settings[],
  ratesData: RatesData | null,
): { rows: { month: string; amount: number }[]; mode: DashboardExpenseChartMode } {
  const combined = mergeMonthBuckets(
    monthBucketsFromPayments(payments, year, settings, ratesData, isExpensePayment),
    monthBucketsFromLedgerDebits(balanceLedger, year, settings, ratesData),
  )
  const rows = bucketsToRows(combined)

  if (rows.some((row) => row.amount > 0)) {
    return { rows, mode: 'actual' }
  }

  const estimated = aggregateEstimatedVpsBurnByMonthYear(
    vps,
    providers,
    year,
    settings,
    ratesData,
  )
  if (estimated.some((row) => row.amount > 0)) {
    return { rows: estimated, mode: 'estimate' }
  }

  return { rows, mode: 'actual' }
}
