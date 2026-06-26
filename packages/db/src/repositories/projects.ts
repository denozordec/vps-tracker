import { randomUUID } from 'node:crypto'
import { eq, like, asc, sql } from 'drizzle-orm'
import { getDb, schema } from '../index.js'

export function normalizeProjectNameInput(name: unknown): string {
  if (name == null) return ''
  return String(name).trim()
}

export function findProjectByNameCaseInsensitive(
  name: string,
): (typeof schema.serverProjects.$inferSelect) | undefined {
  const n = normalizeProjectNameInput(name)
  if (!n) return undefined
  return getDb()
    .select()
    .from(schema.serverProjects)
    .where(eq(sql`LOWER(${schema.serverProjects.name})`, n.toLowerCase()))
    .get()
}

export function resolveOrCreateProject(
  name: unknown,
): { id: string | null; name: string } {
  const n = normalizeProjectNameInput(name)
  if (!n) return { id: null, name: '' }
  const existing = findProjectByNameCaseInsensitive(n)
  if (existing) return { id: existing.id, name: existing.name }
  const id = `proj-${randomUUID()}`
  const now = new Date().toISOString()
  getDb()
    .insert(schema.serverProjects)
    .values({ id, name: n, color: null, sortOrder: 0, notes: null, createdAt: now })
    .run()
  return { id, name: n }
}

export function projectSuggestions(
  q: string,
  limit = 20,
): { id: string; name: string }[] {
  const term = normalizeProjectNameInput(q)
  const lim = Math.min(50, Math.max(1, Number(limit) || 20))
  const db = getDb()
  if (!term) {
    return db
      .select({ id: schema.serverProjects.id, name: schema.serverProjects.name })
      .from(schema.serverProjects)
      .orderBy(asc(schema.serverProjects.name))
      .limit(lim)
      .all()
  }
  const esc = term.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
  const pattern = `%${esc.toLowerCase()}%`
  return db
    .select({ id: schema.serverProjects.id, name: schema.serverProjects.name })
    .from(schema.serverProjects)
    .where(like(sql`LOWER(${schema.serverProjects.name})`, pattern))
    .orderBy(asc(schema.serverProjects.name))
    .limit(lim)
    .all()
}

export function getProjectNameById(id: string): string {
  const row = getDb()
    .select({ name: schema.serverProjects.name })
    .from(schema.serverProjects)
    .where(eq(schema.serverProjects.id, id))
    .get()
  return row?.name ?? ''
}

export const projectsRepository = {
  list(): (typeof schema.serverProjects.$inferSelect)[] {
    return getDb()
      .select()
      .from(schema.serverProjects)
      .orderBy(asc(schema.serverProjects.name))
      .all()
  },
  create(input: { name: string; color?: string | null; notes?: string | null }) {
    const id = `proj-${randomUUID()}`
    const now = new Date().toISOString()
    getDb()
      .insert(schema.serverProjects)
      .values({
        id,
        name: input.name,
        color: input.color ?? null,
        sortOrder: 0,
        notes: input.notes ?? null,
        createdAt: now,
      })
      .run()
    return this.list().find((p) => p.id === id)!
  },
  update(
    id: string,
    input: Partial<{ name: string; color: string | null; notes: string | null }>,
  ) {
    const existing = getDb()
      .select()
      .from(schema.serverProjects)
      .where(eq(schema.serverProjects.id, id))
      .get()
    if (!existing) return undefined
    getDb()
      .update(schema.serverProjects)
      .set({
        name: input.name ?? existing.name,
        color: input.color ?? existing.color,
        notes: input.notes ?? existing.notes,
      })
      .where(eq(schema.serverProjects.id, id))
      .run()
    return getDb().select().from(schema.serverProjects).where(eq(schema.serverProjects.id, id)).get()
  },
  delete(id: string): boolean {
    const r = getDb().delete(schema.serverProjects).where(eq(schema.serverProjects.id, id)).run()
    return r.changes > 0
  },
}
