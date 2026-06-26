import type { Settings, RatesData, Vps, Provider } from '@/types/entities'

export function uid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function normalizeWebsiteUrl(website?: string): string {
  if (!website) return ''
  if (website.startsWith('http://') || website.startsWith('https://')) return website
  return `https://${website}`
}

export function faviconUrlFromWebsite(website?: string): string {
  const normalized = normalizeWebsiteUrl(website)
  if (!normalized) return ''
  try {
    const { hostname } = new URL(normalized)
    return `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`
  } catch {
    return ''
  }
}

const COUNTRY_CODE_BY_NAME: Record<string, string> = {
  germany: 'DE', netherlands: 'NL', russia: 'RU', usa: 'US', 'united states': 'US',
  ukraine: 'UA', poland: 'PL', france: 'FR', spain: 'ES', italy: 'IT',
  estonia: 'EE', finland: 'FI', sweden: 'SE', norway: 'NO', latvia: 'LV',
  lithuania: 'LT', czechia: 'CZ', czech: 'CZ', singapore: 'SG', japan: 'JP',
  canada: 'CA', brazil: 'BR', turkey: 'TR', georgia: 'GE', kazakhstan: 'KZ',
}

export function getCountryFlagEmoji(country?: string): string {
  if (!country) return '🌐'
  const code = COUNTRY_CODE_BY_NAME[country.trim().toLowerCase()]
  if (!code) return '🌐'
  return code.toUpperCase().split('').map((c) => String.fromCodePoint(127397 + c.charCodeAt(0))).join('')
}

/** Флаг по ISO 3166-1 alpha-2 коду страны. */
export function getCountryFlagEmojiByCode(code?: string): string {
  if (!code || code.length !== 2) return '🌐'
  return code.toUpperCase().split('').map((c) => String.fromCodePoint(127397 + c.charCodeAt(0))).join('')
}

const PAYMENT_TYPE_LABELS: Record<string, string> = {
  direct_vps_payment: 'Прямой платеж за VPS',
  provider_balance_topup: 'Пополнение баланса хостера',
  daily_debit: 'Ежедневное списание',
  monthly_debit: 'Ежемесячное списание',
}

export function paymentTypeLabel(type: string): string {
  return PAYMENT_TYPE_LABELS[type] ?? type
}

const VPS_STATUS_LABELS: Record<string, string> = {
  active: 'Активен', paused: 'Приостановлен', archived: 'Архив',
}

export function vpsStatusLabel(status: string): string {
  return VPS_STATUS_LABELS[status] ?? status
}

const BILLING_MODE_LABELS: Record<string, string> = {
  daily: 'Ежедневно', monthly: 'Ежемесячно',
}

export function billingModeLabel(mode: string): string {
  return BILLING_MODE_LABELS[mode] ?? mode
}

const TARIFF_TYPE_LABELS: Record<string, string> = {
  daily: 'Суточный', monthly: 'Месячный',
}

export function tariffTypeLabel(type: string): string {
  return TARIFF_TYPE_LABELS[type] ?? type
}

const ENVIRONMENT_LABELS: Record<string, string> = {
  prod: 'Production', dev: 'Development', staging: 'Staging',
}

export function environmentLabel(env: string): string {
  return ENVIRONMENT_LABELS[env] ?? env
}

const CURRENCY_SYMBOL_MAP: Record<string, string> = {
  '€': 'EUR', '$': 'USD', '₽': 'RUB', '£': 'GBP', '¥': 'JPY', '₴': 'UAH', '₸': 'KZT',
}

export function toIsoCurrency(currency?: string | null): string {
  if (!currency || typeof currency !== 'string') return 'USD'
  const trimmed = currency.trim()
  if (CURRENCY_SYMBOL_MAP[trimmed]) return CURRENCY_SYMBOL_MAP[trimmed]
  const upper = trimmed.toUpperCase()
  if (upper === 'RUR') return 'RUB'
  if (trimmed.length === 3 && /^[A-Z]{3}$/i.test(trimmed)) return upper
  return 'USD'
}

export function effectiveVpsTariffCurrency(vps: Vps, provider?: Provider | null): string {
  const provRaw = (provider?.baseCurrency || '').trim()
  if (provRaw) return toIsoCurrency(provRaw)
  const ownRaw = (vps?.currency || '').trim()
  if (ownRaw) return toIsoCurrency(ownRaw)
  return 'RUB'
}

export function formatCurrency(amount: number, currency = 'USD'): string {
  const safeAmount = Number.isFinite(Number(amount)) ? Number(amount) : 0
  const isoCurrency = toIsoCurrency(currency)
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency', currency: isoCurrency, minimumFractionDigits: 2,
  }).format(safeAmount)
}

export function parseProviderFxRate(raw: unknown): number {
  if (raw == null) return NaN
  const s = String(raw).trim()
  if (!s) return NaN
  if (s.toLowerCase() === 'auto') return NaN
  const n = Number(s.replace(',', '.'))
  if (!Number.isFinite(n) || n <= 0) return NaN
  return n
}

export function normalizeRatesPayload(payload: unknown): RatesData | null {
  if (!payload || typeof payload !== 'object') return null
  const p = payload as Record<string, unknown>
  if (p.base && p.rates && typeof p.rates === 'object') return p as unknown as RatesData
  const valute = p.Valute as Record<string, { CharCode?: string; Value?: number; Nominal?: number }> | undefined
  if (valute && typeof valute === 'object') {
    const rates: Record<string, number> = {}
    for (const v of Object.values(valute)) {
      const code = v?.CharCode
      const val = Number(v?.Value)
      const nom = Number(v?.Nominal) || 1
      if (typeof code === 'string' && code.length === 3 && Number.isFinite(val) && val > 0 && nom > 0) {
        rates[code] = nom / val
      }
    }
    if (Object.keys(rates).length === 0) return null
    return { base: 'RUB', rates, date: typeof p.Date === 'string' ? p.Date : '' }
  }
  return null
}

export function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  ratesData: RatesData | null,
): number {
  const safeAmount = Number(amount)
  if (!Number.isFinite(safeAmount)) return 0
  const from = toIsoCurrency(fromCurrency)
  const to = toIsoCurrency(toCurrency)
  if (!from || !to || from === to) return safeAmount
  if (!ratesData || !ratesData.rates || !ratesData.base) return safeAmount
  const apiBase = ratesData.base.toUpperCase()
  const rates: Record<string, number> = { ...ratesData.rates, [apiBase]: 1 }
  const rateFrom = rates[from]
  const rateTo = rates[to]
  if (!Number.isFinite(rateFrom) || rateFrom <= 0 || !Number.isFinite(rateTo) || rateTo <= 0) {
    return safeAmount
  }
  return (safeAmount / rateFrom) * rateTo
}

export function formatInBaseCurrency(
  amount: number,
  currency: string,
  appSettings: Settings[] | Settings | null | undefined,
  ratesData: RatesData | null,
): string {
  const settings: Partial<Settings> = Array.isArray(appSettings)
    ? (appSettings[0] ?? {})
    : (appSettings ?? {})
  const baseCurrency = settings.baseCurrency || 'RUB'
  const autoConvert = settings.autoConvert !== false
  if (!autoConvert) return formatCurrency(amount, currency)
  const converted = convertCurrency(amount, currency, baseCurrency, ratesData)
  return formatCurrency(converted, baseCurrency)
}

export interface ConvertedWithProvider {
  value: number
  currency: string
  source: 'native' | 'provider' | 'global' | 'no-rates'
}

export function convertWithProviderRate(
  amount: number,
  currency: string,
  provider: Provider | null | undefined,
  appSettings: Settings[] | Settings | null,
  ratesData: RatesData | null,
): ConvertedWithProvider {
  const safeAmount = Number(amount)
  const settings: Partial<Settings> = Array.isArray(appSettings)
    ? (appSettings[0] ?? {})
    : (appSettings ?? {})
  const appBase = (settings.baseCurrency || 'RUB').toUpperCase()
  if (!Number.isFinite(safeAmount)) return { value: 0, currency: appBase, source: 'global' }
  const fromCurrency = toIsoCurrency(currency || appBase)
  if (fromCurrency === appBase) return { value: safeAmount, currency: appBase, source: 'native' }

  const usdRate = parseProviderFxRate(provider?.usdRate)
  const eurRate = parseProviderFxRate(provider?.eurRate)
  if (fromCurrency === 'USD' && Number.isFinite(usdRate)) {
    return { value: safeAmount * usdRate, currency: appBase, source: 'provider' }
  }
  if (fromCurrency === 'EUR' && Number.isFinite(eurRate)) {
    return { value: safeAmount * eurRate, currency: appBase, source: 'provider' }
  }
  if (!ratesData || !ratesData.rates || !ratesData.base) {
    return { value: safeAmount, currency: fromCurrency, source: 'no-rates' }
  }
  const converted = convertCurrency(safeAmount, fromCurrency, appBase, ratesData)
  const oneConverted = convertCurrency(1, fromCurrency, appBase, ratesData)
  const globalRatesWork = Number.isFinite(oneConverted) && Math.abs(oneConverted - 1) > 1e-8
  return { value: converted, currency: appBase, source: globalRatesWork ? 'global' : 'no-rates' }
}

export function formatInProviderCurrency(
  amount: number,
  currency: string,
  provider: Provider | null | undefined,
  appSettings: Settings[] | Settings | null,
  ratesData: RatesData | null,
): string {
  const converted = convertWithProviderRate(amount, currency, provider, appSettings, ratesData)
  return formatCurrency(converted.value, converted.currency)
}

export function monthKey(dateString: string): string {
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return ''
  const headers = Object.keys(rows[0])
  const escapeValue = (value: unknown) => {
    const str = `${value ?? ''}`
    if (str.includes('"') || str.includes(',') || str.includes('\n')) {
      return `"${str.replaceAll('"', '""')}"`
    }
    return str
  }
  const lines = [headers.join(',')]
  for (const row of rows) {
    lines.push(headers.map((h) => escapeValue(row[h])).join(','))
  }
  return lines.join('\n')
}

export function downloadTextFile(fileName: string, content: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  URL.revokeObjectURL(url)
}

export function downloadBlob(fileName: string, blob: Blob): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  URL.revokeObjectURL(url)
}
