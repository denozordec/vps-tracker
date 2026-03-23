/**
 * Утилиты vps-tracker: ID, URL, форматирование, валюта, лейблы, CSV
 */

/**
 * Генерирует уникальный ID (UUID или fallback)
 * @returns {string}
 */
export function uid() {
  if (crypto && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

/**
 * Добавляет https:// к URL при отсутствии протокола
 * @param {string} website
 * @returns {string}
 */
export function normalizeWebsiteUrl(website) {
  if (!website) {
    return ''
  }
  if (website.startsWith('http://') || website.startsWith('https://')) {
    return website
  }
  return `https://${website}`
}

/**
 * URL иконки сайта через Google Favicon API
 * @param {string} website
 * @returns {string}
 */
export function faviconUrlFromWebsite(website) {
  const normalized = normalizeWebsiteUrl(website)
  if (!normalized) {
    return ''
  }
  try {
    const { hostname } = new URL(normalized)
    return `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`
  } catch {
    return ''
  }
}

const countryCodeByName = {
  germany: 'DE',
  netherlands: 'NL',
  russia: 'RU',
  usa: 'US',
  'united states': 'US',
  ukraine: 'UA',
  poland: 'PL',
  france: 'FR',
  spain: 'ES',
  italy: 'IT',
  estonia: 'EE',
  finland: 'FI',
  sweden: 'SE',
  norway: 'NO',
  latvia: 'LV',
  lithuania: 'LT',
  czechia: 'CZ',
  czech: 'CZ',
  singapore: 'SG',
  japan: 'JP',
  canada: 'CA',
  brazil: 'BR',
  turkey: 'TR',
  georgia: 'GE',
  kazakhstan: 'KZ',
}

/**
 * Эмодзи флага страны по названию (ru-RU)
 * @param {string} country - название страны
 * @returns {string} эмодзи флага или 🌐
 */
export function getCountryFlagEmoji(country) {
  if (!country) {
    return '🌐'
  }
  const code = countryCodeByName[country.trim().toLowerCase()]
  if (!code) {
    return '🌐'
  }
  return code
    .toUpperCase()
    .split('')
    .map((char) => String.fromCodePoint(127397 + char.charCodeAt(0)))
    .join('')
}

const paymentTypeLabels = {
  direct_vps_payment: 'Прямой платеж за VPS',
  provider_balance_topup: 'Пополнение баланса хостера',
  daily_debit: 'Ежедневное списание',
  monthly_debit: 'Ежемесячное списание',
}

/**
 * Человекочитаемая метка типа платежа
 * @param {string} type - direct_vps_payment | provider_balance_topup | daily_debit | monthly_debit
 * @returns {string}
 */
export function paymentTypeLabel(type) {
  return paymentTypeLabels[type] || type
}

const vpsStatusLabels = {
  active: 'Активен',
  paused: 'Приостановлен',
  archived: 'Архив',
}

/**
 * Человекочитаемая метка статуса VPS
 * @param {string} status - active | paused | archived
 * @returns {string}
 */
export function vpsStatusLabel(status) {
  return vpsStatusLabels[status] || status
}

const billingModeLabels = {
  daily: 'Ежедневно',
  monthly: 'Ежемесячно',
}

/**
 * Человекочитаемая метка режима биллинга
 * @param {string} mode - daily | monthly
 * @returns {string}
 */
export function billingModeLabel(mode) {
  return billingModeLabels[mode] || mode
}

const tariffTypeLabels = {
  daily: 'Суточный',
  monthly: 'Месячный',
}

/**
 * Человекочитаемая метка типа тарифа
 * @param {string} type - daily | monthly
 * @returns {string}
 */
export function tariffTypeLabel(type) {
  return tariffTypeLabels[type] || type
}

const CURRENCY_SYMBOL_MAP = {
  '€': 'EUR',
  '$': 'USD',
  '₽': 'RUB',
  '£': 'GBP',
  '¥': 'JPY',
  '₴': 'UAH',
  '₸': 'KZT',
}

function toIsoCurrency(currency) {
  if (!currency || typeof currency !== 'string') return 'USD'
  const trimmed = currency.trim()
  if (CURRENCY_SYMBOL_MAP[trimmed]) return CURRENCY_SYMBOL_MAP[trimmed]
  const upper = trimmed.toUpperCase()
  if (upper === 'RUR') return 'RUB'
  if (trimmed.length === 3 && /^[A-Z]{3}$/i.test(trimmed)) return upper
  return 'USD'
}

/**
 * Валюта тарифа VPS = валюта хостера (provider.baseCurrency).
 * vps.currency — только как запасной вариант, если хостер не найден.
 */
export function effectiveVpsTariffCurrency(vps, provider) {
  const provRaw = (provider?.baseCurrency || '').trim()
  if (provRaw) return toIsoCurrency(provRaw)
  const ownRaw = (vps?.currency || '').trim()
  if (ownRaw) return toIsoCurrency(ownRaw)
  return 'RUB'
}

/**
 * Форматирует сумму в валюте (ru-RU)
 * @param {number} amount
 * @param {string} [currency='USD']
 * @returns {string}
 */
export function formatCurrency(amount, currency = 'USD') {
  const safeAmount = Number.isFinite(Number(amount)) ? Number(amount) : 0
  const isoCurrency = toIsoCurrency(currency)
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: isoCurrency,
    minimumFractionDigits: 2,
  }).format(safeAmount)
}

/**
 * Числовой курс хостера из справочника: только явное положительное число.
 * Пусто, «auto», невалид — нет своего курса, используется ссылка на курсы из настроек.
 * @param {unknown} raw
 * @returns {number}
 */
export function parseProviderFxRate(raw) {
  if (raw == null) return NaN
  const s = String(raw).trim()
  if (!s) return NaN
  if (s.toLowerCase() === 'auto') return NaN
  const n = Number(s.replace(',', '.'))
  if (!Number.isFinite(n) || n <= 0) return NaN
  return n
}

/**
 * Приводит ответ API курсов к виду { base, rates }.
 * Поддержка JSON ЦБ с полем Valute (daily_json.js) и уже нормализованного latest.js.
 * @param {object|null|undefined} payload
 * @returns {{ base: string, rates: object, date?: string }|null}
 */
export function normalizeRatesPayload(payload) {
  if (!payload || typeof payload !== 'object') return null
  if (payload.base && payload.rates && typeof payload.rates === 'object') {
    return payload
  }
  if (payload.Valute && typeof payload.Valute === 'object') {
    const rates = {}
    for (const v of Object.values(payload.Valute)) {
      const code = v?.CharCode
      const val = Number(v?.Value)
      const nom = Number(v?.Nominal) || 1
      if (
        typeof code === 'string' &&
        code.length === 3 &&
        Number.isFinite(val) &&
        val > 0 &&
        nom > 0
      ) {
        rates[code] = nom / val
      }
    }
    if (Object.keys(rates).length === 0) return null
    return {
      base: 'RUB',
      rates,
      date: typeof payload.Date === 'string' ? payload.Date : '',
    }
  }
  return null
}

/**
 * Конвертирует сумму из одной валюты в другую по ratesData (CBR и т.п.)
 * @param {number} amount
 * @param {string} fromCurrency
 * @param {string} toCurrency
 * @param {object} ratesData - { base, rates: { USD: 1.2, EUR: 1.1, ... } }
 * @returns {number}
 */
export function convertCurrency(amount, fromCurrency, toCurrency, ratesData) {
  const safeAmount = Number(amount)
  if (!Number.isFinite(safeAmount)) {
    return 0
  }
  const from = toIsoCurrency(fromCurrency)
  const to = toIsoCurrency(toCurrency)
  if (!from || !to || from === to) {
    return safeAmount
  }
  if (!ratesData || !ratesData.rates || !ratesData.base) {
    return safeAmount
  }
  const apiBase = ratesData.base.toUpperCase()
  const rates = { ...ratesData.rates, [apiBase]: 1 }

  const rateFrom = rates[from]
  const rateTo = rates[to]
  if (!Number.isFinite(rateFrom) || rateFrom <= 0 || !Number.isFinite(rateTo) || rateTo <= 0) {
    return safeAmount
  }

  const amountInApiBase = safeAmount / rateFrom
  return amountInApiBase * rateTo
}

/**
 * Форматирует сумму в базовой валюте приложения (settings.baseCurrency)
 * @param {number} amount
 * @param {string} currency
 * @param {object[]} appSettings - settings из API
 * @param {object} ratesData
 * @returns {string}
 */
export function formatInBaseCurrency(amount, currency, appSettings, ratesData) {
  const settings = appSettings?.[0] || {}
  const baseCurrency = settings.baseCurrency || 'RUB'
  const autoConvert = settings.autoConvert !== false

  if (!autoConvert) {
    return formatCurrency(amount, currency)
  }

  const converted = convertCurrency(amount, currency, baseCurrency, ratesData)
  return formatCurrency(converted, baseCurrency)
}

/**
 * Конвертирует сумму в валюту отображения (из настроек).
 * provider.baseCurrency — валюта, в которой хостер принимает платежи.
 * settings.baseCurrency — валюта отображения на дашбордах.
 * Курсы хостера (usdRate, eurRate) — только если заданы явные числа; иначе — курсы по ссылке из настроек.
 */
export function convertWithProviderRate(amount, currency, provider, appSettings, ratesData) {
  const safeAmount = Number(amount)
  const appBase = (appSettings?.[0]?.baseCurrency || 'RUB').toUpperCase()
  if (!Number.isFinite(safeAmount)) {
    return { value: 0, currency: appBase, source: 'global' }
  }

  const fromCurrency = toIsoCurrency(currency || appBase)

  if (fromCurrency === appBase) {
    return { value: safeAmount, currency: appBase, source: 'native' }
  }

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
  // При сумме 0 convertCurrency даёт 0 = исходной сумме — нельзя отличить «успех» от сбоя.
  // Проверяем конвертацию 1 единицы: при отсутствии курсов convertCurrency возвращает 1 без изменений.
  const oneConverted = convertCurrency(1, fromCurrency, appBase, ratesData)
  const globalRatesWork =
    Number.isFinite(oneConverted) && Math.abs(oneConverted - 1) > 1e-8
  return {
    value: converted,
    currency: appBase,
    source: globalRatesWork ? 'global' : 'no-rates',
  }
}

/**
 * Форматирует сумму с учётом курсов провайдера (usdRate, eurRate)
 * @param {number} amount
 * @param {string} currency
 * @param {object} provider
 * @param {object[]} appSettings
 * @param {object} ratesData
 * @returns {string}
 */
export function formatInProviderCurrency(amount, currency, provider, appSettings, ratesData) {
  const converted = convertWithProviderRate(amount, currency, provider, appSettings, ratesData)
  return formatCurrency(converted.value, converted.currency)
}

/**
 * Ключ месяца для группировки: "2025-03"
 * @param {string} dateString
 * @returns {string}
 */
export function monthKey(dateString) {
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) {
    return ''
  }
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

/**
 * Преобразует массив объектов в CSV-строку
 * @param {object[]} rows
 * @returns {string}
 */
export function toCsv(rows) {
  if (!rows.length) {
    return ''
  }
  const headers = Object.keys(rows[0])
  const escapeValue = (value) => {
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

/**
 * Инициирует скачивание текстового файла (CSV)
 * @param {string} fileName
 * @param {string} content
 */
export function downloadTextFile(fileName, content) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  URL.revokeObjectURL(url)
}

/**
 * @param {string} fileName
 * @param {Blob} blob
 */
export function downloadBlob(fileName, blob) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  URL.revokeObjectURL(url)
}
