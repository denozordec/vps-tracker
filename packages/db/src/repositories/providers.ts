import { asc, eq } from 'drizzle-orm'
import { getDb, schema, type Db } from '../index.js'
import { generateId } from './utils.js'

export type ProviderInsert = Partial<typeof schema.providers.$inferInsert> & {
  name: string
}

function normalize(input: Partial<typeof schema.providers.$inferInsert>) {
  return {
    name: input.name ?? '',
    website: input.website ?? '',
    contact: input.contact ?? '',
    baseCurrency: input.baseCurrency ?? '',
    usdRate: input.usdRate ?? '',
    eurRate: input.eurRate ?? '',
    notes: input.notes ?? '',
    apiType: input.apiType ?? '',
    apiBaseUrl: input.apiBaseUrl ?? '',
  }
}

export const providersRepository = {
  list(): (typeof schema.providers.$inferSelect)[] {
    return getDb().select().from(schema.providers).orderBy(asc(schema.providers.name)).all()
  },

  get(id: string): (typeof schema.providers.$inferSelect) | undefined {
    return getDb().select().from(schema.providers).where(eq(schema.providers.id, id)).get()
  },

  create(input: ProviderInsert, id?: string): (typeof schema.providers.$inferSelect) {
    const db: Db = getDb()
    const finalId = id ?? input.id ?? generateId('provider')
    db.insert(schema.providers)
      .values({ id: finalId, ...normalize(input) })
      .run()
    return this.get(finalId)!
  },

  update(
    id: string,
    input: Partial<typeof schema.providers.$inferInsert>,
  ): (typeof schema.providers.$inferSelect) | undefined {
    const db = getDb()
    const existing = this.get(id)
    if (!existing) return undefined
    const merged = {
      ...existing,
      ...normalize({ ...existing, ...input }),
    }
    db.update(schema.providers)
      .set(merged)
      .where(eq(schema.providers.id, id))
      .run()
    return this.get(id)
  },

  delete(id: string): boolean {
    const res = getDb().delete(schema.providers).where(eq(schema.providers.id, id)).run()
    return res.changes > 0
  },
}
