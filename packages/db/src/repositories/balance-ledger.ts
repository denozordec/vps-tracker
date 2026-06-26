import { desc, eq } from 'drizzle-orm'
import { getDb, schema } from '../index.js'
import { generateId } from './utils.js'

type Row = typeof schema.balanceLedger.$inferSelect
type Insert = Partial<typeof schema.balanceLedger.$inferInsert> & {
  type: string
  date: string
  amount: number
}

function normalize(input: Partial<Row>) {
  return {
    type: input.type ?? '',
    date: input.date ?? '',
    amount: Number(input.amount) || 0,
    currency: input.currency ?? '',
    direction: input.direction ?? '',
    providerAccountId: input.providerAccountId ?? '',
    vpsId: input.vpsId ?? '',
    note: input.note ?? '',
  }
}

export const balanceLedgerRepository = {
  list(): Row[] {
    return getDb().select().from(schema.balanceLedger).orderBy(desc(schema.balanceLedger.date)).all()
  },
  get(id: string): Row | undefined {
    return getDb().select().from(schema.balanceLedger).where(eq(schema.balanceLedger.id, id)).get()
  },
  create(input: Insert, id?: string): Row {
    const finalId = id ?? input.id ?? generateId('ledger')
    getDb().insert(schema.balanceLedger).values({ id: finalId, ...normalize(input) }).run()
    return this.get(finalId)!
  },
  update(id: string, input: Partial<Row>): Row | undefined {
    const existing = this.get(id)
    if (!existing) return undefined
    getDb()
      .update(schema.balanceLedger)
      .set(normalize({ ...existing, ...input }))
      .where(eq(schema.balanceLedger.id, id))
      .run()
    return this.get(id)
  },
  delete(id: string): boolean {
    const r = getDb().delete(schema.balanceLedger).where(eq(schema.balanceLedger.id, id)).run()
    return r.changes > 0
  },
}
