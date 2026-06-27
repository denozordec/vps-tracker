import { asc, eq } from 'drizzle-orm'
import { getDb, schema } from '../index.js'

type Row = typeof schema.activeTariffs.$inferSelect

export type ActiveTariffDto = Omit<Row, 'orderAvailable' | 'ramGb' | 'price'> & {
  orderAvailable: boolean
  ramGb: number
  monthlyRate: number | null
  currency: string | null
}

/** Парсит строку цены BILLmanager: «100.50 RUB», «€12», «12 USD». */
export function parseTariffPrice(price: string | null | undefined): {
  monthlyRate: number | null
  currency: string | null
} {
  const raw = String(price ?? '').trim()
  if (!raw) return { monthlyRate: null, currency: null }
  const match = raw.match(/([\d.,]+)\s*([A-Za-z]{3})?/)
  if (!match) return { monthlyRate: null, currency: null }
  const monthlyRate = Number.parseFloat(match[1].replace(',', '.'))
  const currency = match[2]?.toUpperCase() ?? null
  return {
    monthlyRate: Number.isFinite(monthlyRate) ? monthlyRate : null,
    currency,
  }
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
