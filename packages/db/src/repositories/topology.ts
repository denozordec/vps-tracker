import { randomUUID } from 'node:crypto'
import { and, asc, eq } from 'drizzle-orm'
import {
  EMPTY_TOPOLOGY_DOCUMENT,
  type TopologyDocument,
  type TopologyUpdateInput,
} from '@cfdm/shared/contracts/topology'
import { getDb, schema } from '../index.js'
import { getCurrentSpaceId } from '../space-context.js'

function parseDocument(raw: string): TopologyDocument {
  try {
    const parsed = JSON.parse(raw) as TopologyDocument
    if (!parsed || !Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) {
      return { ...EMPTY_TOPOLOGY_DOCUMENT }
    }
    return {
      nodes: parsed.nodes,
      edges: parsed.edges,
      viewport: parsed.viewport ?? { x: 0, y: 0, zoom: 1 },
    }
  } catch {
    return { ...EMPTY_TOPOLOGY_DOCUMENT }
  }
}

function toDto(row: typeof schema.topologyDiagrams.$inferSelect) {
  return {
    id: row.id,
    spaceId: row.spaceId,
    name: row.name,
    document: parseDocument(row.document),
    locked: row.locked === 1,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function toListItem(row: typeof schema.topologyDiagrams.$inferSelect) {
  return {
    id: row.id,
    spaceId: row.spaceId,
    name: row.name,
    locked: row.locked === 1,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export const topologyRepository = {
  list() {
    const spaceId = getCurrentSpaceId()
    return getDb()
      .select()
      .from(schema.topologyDiagrams)
      .where(eq(schema.topologyDiagrams.spaceId, spaceId))
      .orderBy(asc(schema.topologyDiagrams.createdAt))
      .all()
      .map(toListItem)
  },

  get(id: string) {
    const spaceId = getCurrentSpaceId()
    const row = getDb()
      .select()
      .from(schema.topologyDiagrams)
      .where(
        and(
          eq(schema.topologyDiagrams.id, id),
          eq(schema.topologyDiagrams.spaceId, spaceId),
        ),
      )
      .get()
    return row ? toDto(row) : undefined
  },

  create(input: { name: string; document?: TopologyDocument }) {
    const id = `topo-${randomUUID()}`
    const now = new Date().toISOString()
    const document = input.document ?? { ...EMPTY_TOPOLOGY_DOCUMENT }
    getDb()
      .insert(schema.topologyDiagrams)
      .values({
        id,
        spaceId: getCurrentSpaceId(),
        name: input.name.trim(),
        document: JSON.stringify(document),
        locked: 0,
        createdAt: now,
        updatedAt: now,
      })
      .run()
    return this.get(id)!
  },

  update(id: string, input: TopologyUpdateInput) {
    const existing = this.get(id)
    if (!existing) return { ok: false as const, reason: 'not_found' as const }

    if (
      input.expectedUpdatedAt &&
      input.expectedUpdatedAt !== existing.updatedAt
    ) {
      return { ok: false as const, reason: 'stale' as const, current: existing }
    }

    const now = new Date().toISOString()
    getDb()
      .update(schema.topologyDiagrams)
      .set({
        name: input.name !== undefined ? input.name.trim() : existing.name,
        document:
          input.document !== undefined
            ? JSON.stringify(input.document)
            : JSON.stringify(existing.document),
        locked:
          input.locked !== undefined
            ? input.locked
              ? 1
              : 0
            : existing.locked
              ? 1
              : 0,
        updatedAt: now,
      })
      .where(
        and(
          eq(schema.topologyDiagrams.id, id),
          eq(schema.topologyDiagrams.spaceId, existing.spaceId),
        ),
      )
      .run()

    return { ok: true as const, diagram: this.get(id)! }
  },

  delete(id: string): boolean {
    const existing = this.get(id)
    if (!existing) return false
    const r = getDb()
      .delete(schema.topologyDiagrams)
      .where(
        and(
          eq(schema.topologyDiagrams.id, id),
          eq(schema.topologyDiagrams.spaceId, existing.spaceId),
        ),
      )
      .run()
    return r.changes > 0
  },
}
