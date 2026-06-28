import { asc, eq } from 'drizzle-orm'
import { getDb, schema } from '../index.js'

type Row = typeof schema.activeTariffs.$inferSelect

export type ActiveTariffDto = Omit<Row, 'orderAvailable' | 'ramGb' | 'price'> & {
  orderAvailable: boolean
  ramGb: number
  monthlyRate: number | null
  currency: string | null
}

/** Результат парсинга строки цены тарифа. */
export interface ParsedTariffPrice {
  /** Сумма из строки (суточная для /day, месячная иначе). */
  amount: number | null
  monthlyRate: number | null
  currency: string | null
  period: 'day' | 'month' | null
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  '₽': 'RUB',
  '€': 'EUR',
  '$': 'USD',
  '£': 'GBP',
}

function isDailyTariffPrice(raw: string): boolean {
  return /\/\s*(?:day|день)/i.test(raw) || /\b(?:day|день)\b/i.test(raw)
}

/** Парсит строку цены: BILLmanager «100.50 RUB», UserAPI «1.55 USD/day», «1.55 ₽/день». */
export function parseTariffPrice(price: string | null | undefined): ParsedTariffPrice {
  const raw = String(price ?? '').trim()
  if (!raw) return { amount: null, monthlyRate: null, currency: null, period: null }

  const isDaily = isDailyTariffPrice(raw)

  const isoMatch = raw.match(/([\d.,]+)\s*([A-Za-z]{3})(?:\s*\/\s*(?:day|день))?/i)
  if (isoMatch) {
    const amount = Number.parseFloat(isoMatch[1].replace(',', '.'))
    const currency = isoMatch[2].toUpperCase()
    const period: 'day' | 'month' = isDaily ? 'day' : 'month'
    if (!Number.isFinite(amount)) {
      return { amount: null, monthlyRate: null, currency: null, period: null }
    }
    const monthlyRate = period === 'day' ? roundTariffRate(amount * 30) : roundTariffRate(amount)
    return { amount: roundTariffRate(amount), monthlyRate, currency, period }
  }

  const symbolMatch = raw.match(/([\d.,]+)\s*([₽€$£])/)
  if (symbolMatch) {
    const amount = Number.parseFloat(symbolMatch[1].replace(',', '.'))
    const currency = CURRENCY_SYMBOLS[symbolMatch[2]] ?? null
    const period: 'day' | 'month' = isDaily ? 'day' : 'month'
    if (!Number.isFinite(amount)) {
      return { amount: null, monthlyRate: null, currency: null, period: null }
    }
    const monthlyRate = period === 'day' ? roundTariffRate(amount * 30) : roundTariffRate(amount)
    return { amount: roundTariffRate(amount), monthlyRate, currency, period }
  }

  const legacyMatch = raw.match(/([\d.,]+)\s*([A-Za-z]{3})?/)
  if (legacyMatch) {
    const amount = Number.parseFloat(legacyMatch[1].replace(',', '.'))
    const currency = legacyMatch[2]?.toUpperCase() ?? null
    if (!Number.isFinite(amount)) {
      return { amount: null, monthlyRate: null, currency: null, period: null }
    }
    const monthlyRate = roundTariffRate(amount)
    return { amount: monthlyRate, monthlyRate, currency, period: 'month' }
  }

  return { amount: null, monthlyRate: null, currency: null, period: null }
}

function roundTariffRate(n: number): number {
  return Math.round(n * 100) / 100
}

function toDto(row: Row | undefined): ActiveTariffDto | undefined {
  if (!row) return undefined
  const { monthlyRate, currency } = parseTariffPrice(row.price)
  const { price: _price, ...rest } = row
  return {
    ...rest,
    orderAvailable: Boolean(row.orderAvailable),
    ramGb: row.ramGb != null ? Number(row.ramGb) : 0,
    monthlyRate,
    currency,
  }
}

export const activeTariffsRepository = {
  list(): ActiveTariffDto[] {
    const rows = getDb()
      .select()
      .from(schema.activeTariffs)
      .orderBy(asc(schema.activeTariffs.name))
      .all()
    return rows.map((r) => toDto(r)!) as ActiveTariffDto[]
  },
  byAccount(accountId: string): ActiveTariffDto[] {
    const rows = getDb()
      .select()
      .from(schema.activeTariffs)
      .where(eq(schema.activeTariffs.providerAccountId, accountId))
      .all()
    return rows.map((r) => toDto(r)!) as ActiveTariffDto[]
  },
  upsertMany(rows: (typeof schema.activeTariffs.$inferInsert)[]): void {
    const db = getDb()
    for (const r of rows) {
      const existing = db
        .select({ id: schema.activeTariffs.id })
        .from(schema.activeTariffs)
        .where(eq(schema.activeTariffs.id, r.id))
        .get()
      if (existing) {
        db.update(schema.activeTariffs).set(r).where(eq(schema.activeTariffs.id, r.id)).run()
      } else {
        db.insert(schema.activeTariffs).values(r).run()
      }
    }
  },
}

export type TariffSyncOptionsRow = typeof schema.tariffSyncOptions.$inferSelect
export interface TariffSyncOptionsDto {
  providerAccountId: string
  datacenters: unknown[]
  periods: unknown[]
  syncedAt: string
}

export function toTariffSyncOptionsDto(
  row: TariffSyncOptionsRow | undefined,
): TariffSyncOptionsDto | undefined {
  if (!row) return undefined
  let datacenters: unknown[] = []
  let periods: unknown[] = []
  try {
    datacenters = row.datacenters ? JSON.parse(row.datacenters) : []
  } catch {
    datacenters = []
  }
  try {
    periods = row.periods ? JSON.parse(row.periods) : []
  } catch {
    periods = []
  }
  return {
    providerAccountId: row.providerAccountId,
    datacenters: Array.isArray(datacenters) ? datacenters : [],
    periods: Array.isArray(periods) ? periods : [],
    syncedAt: row.syncedAt ?? '',
  }
}

export const tariffSyncOptionsRepository = {
  list(): TariffSyncOptionsDto[] {
    const rows = getDb().select().from(schema.tariffSyncOptions).all()
    return rows.map((r) => toTariffSyncOptionsDto(r)!) as TariffSyncOptionsDto[]
  },
  byAccount(accountId: string): TariffSyncOptionsDto | undefined {
    return toTariffSyncOptionsDto(
      getDb()
        .select()
        .from(schema.tariffSyncOptions)
        .where(eq(schema.tariffSyncOptions.providerAccountId, accountId))
        .get(),
    )
  },
  upsert(input: typeof schema.tariffSyncOptions.$inferInsert): void {
    const db = getDb()
    const existing = db
      .select({ providerAccountId: schema.tariffSyncOptions.providerAccountId })
      .from(schema.tariffSyncOptions)
      .where(eq(schema.tariffSyncOptions.providerAccountId, input.providerAccountId))
      .get()
    if (existing) {
      db.update(schema.tariffSyncOptions)
        .set(input)
        .where(eq(schema.tariffSyncOptions.providerAccountId, input.providerAccountId))
        .run()
    } else {
      db.insert(schema.tariffSyncOptions).values(input).run()
    }
  },
}
