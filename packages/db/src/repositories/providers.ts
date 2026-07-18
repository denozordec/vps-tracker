import { and, asc, eq } from 'drizzle-orm'
import { getDb, schema, type Db } from '../index.js'
import { getCurrentSpaceId } from '../space-context.js'
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
    const spaceId = getCurrentSpaceId()
    return getDb()
      .select()
      .from(schema.providers)
      .where(eq(schema.providers.spaceId, spaceId))
      .orderBy(asc(schema.providers.name))
      .all()
  },

  get(id: string): (typeof schema.providers.$inferSelect) | undefined {
    const spaceId = getCurrentSpaceId()
    return getDb()
      .select()
      .from(schema.providers)
      .where(and(eq(schema.providers.id, id), eq(schema.providers.spaceId, spaceId)))
      .get()
  },

  create(input: ProviderInsert, id?: string): (typeof schema.providers.$inferSelect) {
    const db: Db = getDb()
    const finalId = id ?? input.id ?? generateId('provider')
    db.insert(schema.providers)
      .values({ id: finalId, spaceId: getCurrentSpaceId(), ...normalize(input) })
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
      spaceId: existing.spaceId,
    }
    db.update(schema.providers)
      .set(merged)
      .where(and(eq(schema.providers.id, id), eq(schema.providers.spaceId, existing.spaceId)))
      .run()
    return this.get(id)
  },

  delete(id: string): boolean {
    const existing = this.get(id)
    if (!existing) return false
    const res = getDb()
      .delete(schema.providers)
      .where(and(eq(schema.providers.id, id), eq(schema.providers.spaceId, existing.spaceId)))
      .run()
    return res.changes > 0
  },
}
