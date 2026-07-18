import { and, desc, eq } from 'drizzle-orm'
import { getDb, schema } from '../index.js'
import { getCurrentSpaceId } from '../space-context.js'
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
    const spaceId = getCurrentSpaceId()
    return getDb()
      .select()
      .from(schema.balanceLedger)
      .where(eq(schema.balanceLedger.spaceId, spaceId))
      .orderBy(desc(schema.balanceLedger.date))
      .all()
  },
  get(id: string): Row | undefined {
    const spaceId = getCurrentSpaceId()
    return getDb()
      .select()
      .from(schema.balanceLedger)
      .where(and(eq(schema.balanceLedger.id, id), eq(schema.balanceLedger.spaceId, spaceId)))
      .get()
  },
  create(input: Insert, id?: string): Row {
    const finalId = id ?? input.id ?? generateId('ledger')
    getDb()
      .insert(schema.balanceLedger)
      .values({ id: finalId, spaceId: getCurrentSpaceId(), ...normalize(input) })
      .run()
    return this.get(finalId)!
  },
  update(id: string, input: Partial<Row>): Row | undefined {
    const existing = this.get(id)
    if (!existing) return undefined
    getDb()
      .update(schema.balanceLedger)
      .set({ ...normalize({ ...existing, ...input }), spaceId: existing.spaceId })
      .where(and(eq(schema.balanceLedger.id, id), eq(schema.balanceLedger.spaceId, existing.spaceId)))
      .run()
    return this.get(id)
  },
  delete(id: string): boolean {
    const existing = this.get(id)
    if (!existing) return false
    const r = getDb()
      .delete(schema.balanceLedger)
      .where(and(eq(schema.balanceLedger.id, id), eq(schema.balanceLedger.spaceId, existing.spaceId)))
      .run()
    return r.changes > 0
  },
}
