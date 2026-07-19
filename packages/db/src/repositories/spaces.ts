import { and, asc, eq, isNotNull, isNull } from 'drizzle-orm'
import { getDb, getSqlite, schema } from '../index.js'
import { generateId } from './utils.js'
import {
  MAIN_SPACE_ID,
  getCurrentSpaceId,
  settingsIdForSpace,
} from '../space-context.js'

export type SpaceRole = 'owner' | 'admin' | 'member' | 'viewer'
export type SpaceKind = 'main' | 'personal'
export type GrantPermission = 'read' | 'write'

export type SpaceRow = typeof schema.spaces.$inferSelect
export type SpaceMemberRow = typeof schema.spaceMembers.$inferSelect
export type VpsGrantRow = typeof schema.vpsGrants.$inferSelect

const ROLE_RANK: Record<SpaceRole, number> = {
  viewer: 1,
  member: 2,
  admin: 3,
  owner: 4,
}

/** Tables with spaceId column — purge order (children first). */
const SPACE_DATA_TABLES = [
  'vps_grants',
  'notification_log',
  'notification_state',
  'vps_health_checks',
  'audit_log',
  'sync_log',
  'active_tariffs',
  'tariff_sync_options',
  'topology_diagrams',
  'vps_domains',
  'balance_ledger',
  'payments',
  'vps',
  'provider_accounts',
  'server_projects',
  'providers',
  'settings',
  'space_members',
] as const

export function roleAtLeast(role: string, min: SpaceRole): boolean {
  return (ROLE_RANK[role as SpaceRole] ?? 0) >= ROLE_RANK[min]
}

export function isSpaceActive(space: Pick<SpaceRow, 'deletedAt'>): boolean {
  return space.deletedAt == null || space.deletedAt === ''
}

function nowIso(): string {
  return new Date().toISOString()
}

export const spacesRepository = {
  listAll(opts?: { includeDeleted?: boolean }): SpaceRow[] {
    const db = getDb()
    if (opts?.includeDeleted) {
      return db.select().from(schema.spaces).orderBy(asc(schema.spaces.name)).all()
    }
    return db
      .select()
      .from(schema.spaces)
      .where(isNull(schema.spaces.deletedAt))
      .orderBy(asc(schema.spaces.name))
      .all()
  },

  listDeleted(): SpaceRow[] {
    return getDb()
      .select()
      .from(schema.spaces)
      .where(isNotNull(schema.spaces.deletedAt))
      .orderBy(asc(schema.spaces.name))
      .all()
  },

  listForUser(
    userId: string,
    isAdmin = false,
    opts?: { deletedOnly?: boolean },
  ): (SpaceRow & { role: string })[] {
    if (opts?.deletedOnly) {
      const deleted = this.listDeleted()
      return deleted
        .filter((s) => {
          if (isAdmin) return true
          return Boolean(this.getMember(s.id, userId))
        })
        .map((s) => {
          const m = this.getMember(s.id, userId)
          return { ...s, role: m?.role ?? (isAdmin ? 'admin' : 'viewer') }
        })
    }

    if (isAdmin) {
      return this.listAll().map((s) => {
        const m = this.getMember(s.id, userId)
        return { ...s, role: m?.role ?? (s.kind === 'main' ? 'admin' : 'viewer') }
      })
    }
    const db = getDb()
    const members = db
      .select()
      .from(schema.spaceMembers)
      .where(eq(schema.spaceMembers.userId, userId))
      .all()
    const out: (SpaceRow & { role: string })[] = []
    for (const m of members) {
      const space = this.get(m.spaceId)
      if (space && isSpaceActive(space)) out.push({ ...space, role: m.role })
    }
    return out.sort((a, b) => a.name.localeCompare(b.name))
  },

  /** Includes soft-deleted */
  getAny(id: string): SpaceRow | undefined {
    return getDb().select().from(schema.spaces).where(eq(schema.spaces.id, id)).get()
  },

  /** Active only */
  get(id: string): SpaceRow | undefined {
    const row = this.getAny(id)
    if (!row || !isSpaceActive(row)) return undefined
    return row
  },

  getMain(): SpaceRow {
    let row = this.getAny(MAIN_SPACE_ID)
    if (!row) {
      row = this.create({
        id: MAIN_SPACE_ID,
        name: 'Основное',
        slug: 'main',
        kind: 'main',
        ownerUserId: process.env.VPS_MAIN_SPACE_OWNER_USER_ID?.trim() || null,
      })
    } else if (!isSpaceActive(row)) {
      // Main must never stay soft-deleted
      this.restore(MAIN_SPACE_ID)
      row = this.getAny(MAIN_SPACE_ID)!
    }
    return row
  },

  create(input: {
    id?: string
    name: string
    slug: string
    kind?: SpaceKind
    ownerUserId?: string | null
  }): SpaceRow {
    const db = getDb()
    const id = input.id ?? generateId('space')
    const createdAt = nowIso()
    db.insert(schema.spaces)
      .values({
        id,
        name: input.name,
        slug: input.slug,
        kind: input.kind ?? 'personal',
        ownerUserId: input.ownerUserId ?? null,
        createdAt,
        deletedAt: null,
      })
      .run()

    if (input.ownerUserId) {
      db.insert(schema.spaceMembers)
        .values({
          spaceId: id,
          userId: input.ownerUserId,
          role: 'owner',
          createdAt,
        })
        .run()
    }

    const settingsId = settingsIdForSpace(id)
    const existingSettings = db
      .select()
      .from(schema.settings)
      .where(eq(schema.settings.id, settingsId))
      .get()
    if (!existingSettings) {
      db.insert(schema.settings)
        .values({
          id: settingsId,
          spaceId: id,
          baseCurrency: 'RUB',
          syncEnabled: 0,
          autoConvert: 0,
        })
        .run()
    }

    return this.getAny(id)!
  },

  update(
    id: string,
    input: Partial<{ name: string; slug: string; ownerUserId: string | null }>,
  ): SpaceRow | undefined {
    const existing = this.getAny(id)
    if (!existing || !isSpaceActive(existing)) return undefined
    getDb()
      .update(schema.spaces)
      .set({
        name: input.name ?? existing.name,
        slug: input.slug ?? existing.slug,
        ownerUserId:
          input.ownerUserId !== undefined ? input.ownerUserId : existing.ownerUserId,
      })
      .where(eq(schema.spaces.id, id))
      .run()
    return this.get(id)
  },

  softDelete(id: string): SpaceRow | undefined {
    const existing = this.getAny(id)
    if (!existing) return undefined
    if (existing.kind === 'main' || id === MAIN_SPACE_ID) return undefined
    if (!isSpaceActive(existing)) return existing
    getDb()
      .update(schema.spaces)
      .set({ deletedAt: nowIso() })
      .where(eq(schema.spaces.id, id))
      .run()
    return this.getAny(id)
  },

  restore(id: string): SpaceRow | undefined {
    const existing = this.getAny(id)
    if (!existing) return undefined
    if (isSpaceActive(existing)) return existing
    getDb()
      .update(schema.spaces)
      .set({ deletedAt: null })
      .where(eq(schema.spaces.id, id))
      .run()
    return this.get(id)
  },

  /**
   * Hard purge — only soft-deleted non-main spaces.
   * Cascade deletes all space-scoped rows.
   */
  purge(id: string): boolean {
    const existing = this.getAny(id)
    if (!existing) return false
    if (existing.kind === 'main' || id === MAIN_SPACE_ID) return false
    if (isSpaceActive(existing)) return false

    const sqlite = getSqlite()
    sqlite.exec('BEGIN')
    try {
      // Grants referencing this space (from or to)
      sqlite
        .prepare(
          `DELETE FROM vps_grants WHERE fromSpaceId = ? OR toSpaceId = ?`,
        )
        .run(id, id)

      for (const table of SPACE_DATA_TABLES) {
        if (table === 'vps_grants' || table === 'space_members') continue
        try {
          sqlite.prepare(`DELETE FROM ${table} WHERE spaceId = ?`).run(id)
        } catch {
          /* table may not exist in older DBs */
        }
      }

      sqlite.prepare(`DELETE FROM space_members WHERE spaceId = ?`).run(id)
      sqlite.prepare(`DELETE FROM spaces WHERE id = ?`).run(id)
      sqlite.exec('COMMIT')
      return true
    } catch (err) {
      sqlite.exec('ROLLBACK')
      throw err
    }
  },

  transferOwnership(
    spaceId: string,
    newOwnerUserId: string,
  ): SpaceRow | undefined {
    const space = this.get(spaceId)
    if (!space) return undefined
    const oldOwnerId = space.ownerUserId

    if (oldOwnerId && oldOwnerId !== newOwnerUserId) {
      this.updateMember(spaceId, oldOwnerId, 'admin')
    }
    this.addMember(spaceId, newOwnerUserId, 'owner')
    getDb()
      .update(schema.spaces)
      .set({ ownerUserId: newOwnerUserId })
      .where(eq(schema.spaces.id, spaceId))
      .run()
    return this.get(spaceId)
  },

  ensurePersonalSpace(userId: string, name?: string): SpaceRow {
    const id = `space-user-${userId}`
    const existing = this.getAny(id)
    if (existing) {
      if (!isSpaceActive(existing)) {
        // Soft-deleted personal — do not recreate same id; fall back to main
        return this.getMain()
      }
      const member = this.getMember(id, userId)
      if (!member) {
        this.addMember(id, userId, 'owner')
      }
      return existing
    }
    return this.create({
      id,
      name: name?.trim() || 'Моё пространство',
      slug: `user-${userId}`,
      kind: 'personal',
      ownerUserId: userId,
    })
  },

  claimMainOwnerIfEmpty(userId: string): void {
    const main = this.getMain()
    if (!main.ownerUserId) {
      this.update(MAIN_SPACE_ID, { ownerUserId: userId })
    }
    const member = this.getMember(MAIN_SPACE_ID, userId)
    if (!member) {
      this.addMember(MAIN_SPACE_ID, userId, 'owner')
    } else if (!roleAtLeast(member.role, 'admin')) {
      this.updateMember(MAIN_SPACE_ID, userId, 'owner')
    }
  },

  getMember(spaceId: string, userId: string): SpaceMemberRow | undefined {
    return getDb()
      .select()
      .from(schema.spaceMembers)
      .where(
        and(
          eq(schema.spaceMembers.spaceId, spaceId),
          eq(schema.spaceMembers.userId, userId),
        ),
      )
      .get()
  },

  listMembers(spaceId: string): SpaceMemberRow[] {
    return getDb()
      .select()
      .from(schema.spaceMembers)
      .where(eq(schema.spaceMembers.spaceId, spaceId))
      .all()
  },

  addMember(spaceId: string, userId: string, role: SpaceRole = 'member'): SpaceMemberRow {
    const existing = this.getMember(spaceId, userId)
    if (existing) {
      return this.updateMember(spaceId, userId, role) ?? existing
    }
    getDb()
      .insert(schema.spaceMembers)
      .values({
        spaceId,
        userId,
        role,
        createdAt: nowIso(),
      })
      .run()
    return this.getMember(spaceId, userId)!
  },

  updateMember(
    spaceId: string,
    userId: string,
    role: SpaceRole,
  ): SpaceMemberRow | undefined {
    const existing = this.getMember(spaceId, userId)
    if (!existing) return undefined
    getDb()
      .update(schema.spaceMembers)
      .set({ role })
      .where(
        and(
          eq(schema.spaceMembers.spaceId, spaceId),
          eq(schema.spaceMembers.userId, userId),
        ),
      )
      .run()
    return this.getMember(spaceId, userId)
  },

  removeMember(spaceId: string, userId: string): boolean {
    const r = getDb()
      .delete(schema.spaceMembers)
      .where(
        and(
          eq(schema.spaceMembers.spaceId, spaceId),
          eq(schema.spaceMembers.userId, userId),
        ),
      )
      .run()
    return r.changes > 0
  },

  canAccess(spaceId: string, userId: string, isAdmin = false): boolean {
    const space = this.get(spaceId)
    if (!space) return false
    if (isAdmin) return true
    return Boolean(this.getMember(spaceId, userId))
  },

  requireRole(
    spaceId: string,
    userId: string,
    min: SpaceRole,
    isAdmin = false,
  ): SpaceMemberRow | null {
    if (!this.get(spaceId) && !isAdmin) return null
    if (isAdmin) {
      return (
        this.getMember(spaceId, userId) ?? {
          spaceId,
          userId,
          role: 'owner',
          createdAt: nowIso(),
        }
      )
    }
    const m = this.getMember(spaceId, userId)
    if (!m || !roleAtLeast(m.role, min)) return null
    return m
  },
}

export const vpsGrantsRepository = {
  listToSpace(toSpaceId: string): VpsGrantRow[] {
    return getDb()
      .select()
      .from(schema.vpsGrants)
      .where(eq(schema.vpsGrants.toSpaceId, toSpaceId))
      .all()
  },

  listFromSpace(fromSpaceId: string): VpsGrantRow[] {
    return getDb()
      .select()
      .from(schema.vpsGrants)
      .where(eq(schema.vpsGrants.fromSpaceId, fromSpaceId))
      .all()
  },

  listAll(): VpsGrantRow[] {
    return getDb().select().from(schema.vpsGrants).all()
  },

  get(id: string): VpsGrantRow | undefined {
    return getDb().select().from(schema.vpsGrants).where(eq(schema.vpsGrants.id, id)).get()
  },

  getForVpsToSpace(vpsId: string, toSpaceId: string): VpsGrantRow | undefined {
    return getDb()
      .select()
      .from(schema.vpsGrants)
      .where(
        and(
          eq(schema.vpsGrants.vpsId, vpsId),
          eq(schema.vpsGrants.toSpaceId, toSpaceId),
        ),
      )
      .get()
  },

  create(input: {
    vpsId: string
    fromSpaceId: string
    toSpaceId: string
    permission: GrantPermission
    grantedByUserId?: string | null
  }): VpsGrantRow {
    const existing = this.getForVpsToSpace(input.vpsId, input.toSpaceId)
    if (existing) {
      getDb()
        .update(schema.vpsGrants)
        .set({
          permission: input.permission,
          grantedByUserId: input.grantedByUserId ?? existing.grantedByUserId,
        })
        .where(eq(schema.vpsGrants.id, existing.id))
        .run()
      return this.get(existing.id)!
    }
    const id = generateId('grant')
    getDb()
      .insert(schema.vpsGrants)
      .values({
        id,
        vpsId: input.vpsId,
        fromSpaceId: input.fromSpaceId,
        toSpaceId: input.toSpaceId,
        permission: input.permission,
        grantedByUserId: input.grantedByUserId ?? null,
        createdAt: nowIso(),
      })
      .run()
    return this.get(id)!
  },

  delete(id: string): boolean {
    const r = getDb().delete(schema.vpsGrants).where(eq(schema.vpsGrants.id, id)).run()
    return r.changes > 0
  },

  deleteByVps(vpsId: string): number {
    const r = getDb()
      .delete(schema.vpsGrants)
      .where(eq(schema.vpsGrants.vpsId, vpsId))
      .run()
    return r.changes
  },

  getGrantInCurrentSpace(vpsId: string): VpsGrantRow | undefined {
    return this.getForVpsToSpace(vpsId, getCurrentSpaceId())
  },
}
