import { randomUUID } from 'node:crypto'
import { and, eq, asc, sql } from 'drizzle-orm'
import { getDb, schema } from '../index.js'
import { getCurrentSpaceId } from '../space-context.js'

export function normalizeProjectNameInput(name: unknown): string {
  if (name == null) return ''
  return String(name).trim()
}

export function findProjectByNameCaseInsensitive(
  name: string,
): (typeof schema.serverProjects.$inferSelect) | undefined {
  const n = normalizeProjectNameInput(name)
  if (!n) return undefined
  // SQLite LOWER()/LIKE fold ASCII only — «Сайт» never matched «сайт», so each VPS created a duplicate project.
  const key = n.toLowerCase()
  return listSpaceProjects().find((p) => p.name.trim().toLowerCase() === key)
}

function listSpaceProjects() {
  return getDb()
    .select()
    .from(schema.serverProjects)
    .where(eq(schema.serverProjects.spaceId, getCurrentSpaceId()))
    .orderBy(asc(schema.serverProjects.name))
    .all()
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
    .values({
      id,
      spaceId: getCurrentSpaceId(),
      name: n,
      color: null,
      sortOrder: 0,
      notes: null,
      createdAt: now,
    })
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
  const spaceId = getCurrentSpaceId()
  if (!term) {
    return db
      .select({ id: schema.serverProjects.id, name: schema.serverProjects.name })
      .from(schema.serverProjects)
      .where(eq(schema.serverProjects.spaceId, spaceId))
      .orderBy(asc(schema.serverProjects.name))
      .limit(lim)
      .all()
  }
  const needle = term.toLowerCase()
  return listSpaceProjects()
    .filter((p) => p.name.toLowerCase().includes(needle))
    .slice(0, lim)
    .map(({ id, name }) => ({ id, name }))
}

export function getProjectNameById(id: string): string {
  const row = getDb()
    .select({ name: schema.serverProjects.name })
    .from(schema.serverProjects)
    .where(eq(schema.serverProjects.id, id))
    .get()
  return row?.name ?? ''
}

function countVpsByProjectId(projectId: string): number {
  const row = getDb()
    .select({ count: sql<number>`count(*)` })
    .from(schema.vps)
    .where(eq(schema.vps.projectId, projectId))
    .get()
  return Number(row?.count ?? 0)
}

export const projectsRepository = {
  list(): (typeof schema.serverProjects.$inferSelect)[] {
    const spaceId = getCurrentSpaceId()
    return getDb()
      .select()
      .from(schema.serverProjects)
      .where(eq(schema.serverProjects.spaceId, spaceId))
      .orderBy(asc(schema.serverProjects.name))
      .all()
  },
  get(id: string): (typeof schema.serverProjects.$inferSelect) | undefined {
    const spaceId = getCurrentSpaceId()
    return getDb()
      .select()
      .from(schema.serverProjects)
      .where(
        and(eq(schema.serverProjects.id, id), eq(schema.serverProjects.spaceId, spaceId)),
      )
      .get()
  },
  getDependencyCounts(id: string): { vps: number } {
    return { vps: countVpsByProjectId(id) }
  },
  create(input: { name: string; color?: string | null; notes?: string | null }) {
    const id = `proj-${randomUUID()}`
    const now = new Date().toISOString()
    getDb()
      .insert(schema.serverProjects)
      .values({
        id,
        spaceId: getCurrentSpaceId(),
        name: input.name,
        color: input.color ?? null,
        sortOrder: 0,
        notes: input.notes ?? null,
        createdAt: now,
      })
      .run()
    return this.get(id)!
  },
  createOrResolve(input: { name: string; color?: string | null; notes?: string | null }) {
    const existing = findProjectByNameCaseInsensitive(input.name)
    if (existing) {
      const hasMeta = input.color !== undefined || input.notes !== undefined
      if (!hasMeta) return existing
      return (
        this.update(existing.id, {
          ...(input.color !== undefined ? { color: input.color } : {}),
          ...(input.notes !== undefined ? { notes: input.notes } : {}),
        }) ?? existing
      )
    }
    return this.create(input)
  },
  update(
    id: string,
    input: Partial<{ name: string; color: string | null; notes: string | null }>,
  ) {
    const existing = this.get(id)
    if (!existing) return undefined
    const nextName = input.name ?? existing.name
    const db = getDb()
    db.transaction(() => {
      db.update(schema.serverProjects)
        .set({
          name: nextName,
          color: input.color !== undefined ? input.color : existing.color,
          notes: input.notes !== undefined ? input.notes : existing.notes,
        })
        .where(
          and(
            eq(schema.serverProjects.id, id),
            eq(schema.serverProjects.spaceId, existing.spaceId),
          ),
        )
        .run()
      if (nextName !== existing.name) {
        db.update(schema.vps)
          .set({ project: nextName })
          .where(eq(schema.vps.projectId, id))
          .run()
      }
    })
    return this.get(id)
  },
  delete(id: string): boolean {
    const existing = this.get(id)
    if (!existing) return false
    const r = getDb()
      .delete(schema.serverProjects)
      .where(
        and(
          eq(schema.serverProjects.id, id),
          eq(schema.serverProjects.spaceId, existing.spaceId),
        ),
      )
      .run()
    return r.changes > 0
  },
}
