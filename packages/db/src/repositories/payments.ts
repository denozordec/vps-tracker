import { desc, eq } from 'drizzle-orm'
import { getDb, schema } from '../index.js'
import { generateId } from './utils.js'

type Row = typeof schema.payments.$inferSelect
type Insert = Partial<typeof schema.payments.$inferInsert> & { type: string; date: string; amount: number }

function normalize(input: Partial<Row>) {
  return {
    type: input.type ?? '',
    date: input.date ?? '',
    amount: Number(input.amount) || 0,
    currency: input.currency ?? '',
    providerAccountId: input.providerAccountId ?? '',
    vpsId: input.vpsId ?? '',
    note: input.note ?? '',
  }
}

export const paymentsRepository = {
  list(): Row[] {
    return getDb().select().from(schema.payments).orderBy(desc(schema.payments.date)).all()
  },
  get(id: string): Row | undefined {
    return getDb().select().from(schema.payments).where(eq(schema.payments.id, id)).get()
  },
  create(input: Insert, id?: string): Row {
    const finalId = id ?? input.id ?? generateId('pay')
    getDb().insert(schema.payments).values({ id: finalId, ...normalize(input) }).run()
    return this.get(finalId)!
  },
  update(id: string, input: Partial<Row>): Row | undefined {
    const existing = this.get(id)
    if (!existing) return undefined
    getDb()
      .update(schema.payments)
      .set(normalize({ ...existing, ...input }))
      .where(eq(schema.payments.id, id))
      .run()
    return this.get(id)
  },
  delete(id: string): boolean {
    const r = getDb().delete(schema.payments).where(eq(schema.payments.id, id)).run()
    return r.changes > 0
  },
}
