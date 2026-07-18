import { and, desc, eq, inArray } from 'drizzle-orm'
import { getDb, schema } from '../index.js'
import { getCurrentSpaceId } from '../space-context.js'
import { generateId } from './utils.js'
import { resolveOrCreateProject, getProjectNameById } from './projects.js'

type VpsRow = typeof schema.vps.$inferSelect

export type VpsDto = Omit<VpsRow, 'additionalIps' | 'userOverrides' | 'projectId' | 'monitoringEnabled' | 'backupEnabled' | 'dailyRate' | 'monthlyRate'> & {
  additionalIps: string[]
  userOverrides: string[]
  projectId: string
  monitoringEnabled: boolean
  backupEnabled: boolean
  dailyRate: number | ''
  monthlyRate: number | ''
  access?: 'owned' | 'shared'
  grantPermission?: 'read' | 'write'
}

const USER_OVERRIDABLE_FIELDS = [
  'country',
  'city',
  'datacenter',
  'os',
  'notes',
  'status',
  'tariffType',
  'currency',
  'dailyRate',
  'monthlyRate',
  'paidUntil',
  'project',
  'vcpu',
  'ramGb',
  'diskGb',
  'diskType',
  'virtualization',
  'purpose',
  'environment',
  'sshPort',
  'rootUser',
  'bandwidthTb',
  'monitoringEnabled',
  'backupEnabled',
] as const

function normNum(v: unknown): number | null {
  if (v === '' || v == null) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function toDto(row: VpsRow | undefined): VpsDto | undefined {
  if (!row) return undefined
  let additionalIps: string[] = []
  try {
    additionalIps = row.additionalIps ? JSON.parse(row.additionalIps) : []
  } catch {
    additionalIps = []
  }
  let userOverrides: string[] = []
  try {
    userOverrides = row.userOverrides ? JSON.parse(row.userOverrides) : []
  } catch {
    userOverrides = []
  }
  return {
    ...row,
    additionalIps,
    userOverrides,
    projectId: row.projectId ?? '',
    monitoringEnabled: Boolean(row.monitoringEnabled),
    backupEnabled: Boolean(row.backupEnabled),
    dailyRate: row.dailyRate != null ? row.dailyRate : '',
    monthlyRate: row.monthlyRate != null ? row.monthlyRate : '',
  }
}

interface VpsInput {
  ip?: string
  ipv6?: string
  additionalIps?: string[]
  dns?: string
  providerId?: string
  providerAccountId?: string
  country?: string
  city?: string
  datacenter?: string
  os?: string
  vcpu?: number
  ramGb?: number
  diskGb?: number
  diskType?: string
  virtualization?: string
  bandwidthTb?: number
  sshPort?: number
  rootUser?: string
  purpose?: string
  environment?: string
  project?: string
  projectId?: string
  monitoringEnabled?: boolean
  backupEnabled?: boolean
  status?: string
  tariffType?: string
  currency?: string
  dailyRate?: number | ''
  monthlyRate?: number | ''
  createdAt?: string
  paidUntil?: string
  notes?: string
  userOverrides?: string[] | 'clear'
  customData?: string | Record<string, unknown>
}

function projectColumnsForSave(projectInput: unknown): { project: string; projectId: string } {
  const resolved = resolveOrCreateProject(projectInput)
  if (!resolved.id) return { project: '', projectId: '' }
  return { project: resolved.name, projectId: resolved.id }
}

function numOrNull(v: unknown): number | null {
  if (v === '' || v == null) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function boolToInt(v: unknown): number {
  return v ? 1 : 0
}

function serializeCustomData(v: unknown): string | null {
  if (v == null) return null
  if (typeof v === 'string') return v || null
  return JSON.stringify(v)
}

function spaceFilter() {
  return eq(schema.vps.spaceId, getCurrentSpaceId())
}

export const vpsRepository = {
  list(): VpsDto[] {
    const rows = getDb()
      .select()
      .from(schema.vps)
      .where(spaceFilter())
      .orderBy(desc(schema.vps.createdAt))
      .all()
    return rows.map((r) => ({ ...toDto(r)!, access: 'owned' as const }))
  },

  listByIds(ids: string[]): VpsDto[] {
    if (ids.length === 0) return []
    const rows = getDb().select().from(schema.vps).where(inArray(schema.vps.id, ids)).all()
    return rows.map((r) => toDto(r)!) as VpsDto[]
  },

  get(id: string): VpsDto | undefined {
    const row = getDb()
      .select()
      .from(schema.vps)
      .where(and(eq(schema.vps.id, id), spaceFilter()))
      .get()
    return row ? { ...toDto(row)!, access: 'owned' } : undefined
  },

  getAnySpace(id: string): VpsDto | undefined {
    const row = getDb().select().from(schema.vps).where(eq(schema.vps.id, id)).get()
    return toDto(row)
  },

  create(input: VpsInput, id?: string): VpsDto {
    const db = getDb()
    const finalId = id ?? generateId('vps')
    const additionalIps = Array.isArray(input.additionalIps) ? JSON.stringify(input.additionalIps) : '[]'
    const { project, projectId } = projectColumnsForSave(input.project)
    db.insert(schema.vps)
      .values({
        id: finalId,
        spaceId: getCurrentSpaceId(),
        ip: input.ip ?? '',
        ipv6: input.ipv6 ?? '',
        additionalIps,
        dns: input.dns ?? '',
        providerId: input.providerId ?? '',
        providerAccountId: input.providerAccountId ?? '',
        country: input.country ?? '',
        city: input.city ?? '',
        datacenter: input.datacenter ?? '',
        os: input.os ?? '',
        vcpu: input.vcpu ?? 0,
        ramGb: input.ramGb ?? 0,
        diskGb: input.diskGb ?? 0,
        diskType: input.diskType ?? '',
        virtualization: input.virtualization ?? '',
        bandwidthTb: input.bandwidthTb ?? 0,
        sshPort: input.sshPort ?? 22,
        rootUser: input.rootUser ?? '',
        purpose: input.purpose ?? '',
        environment: input.environment ?? '',
        project,
        projectId: projectId || null,
        monitoringEnabled: boolToInt(input.monitoringEnabled),
        backupEnabled: boolToInt(input.backupEnabled),
        status: input.status ?? 'active',
        tariffType: input.tariffType ?? '',
        currency: input.currency ?? '',
        dailyRate: numOrNull(input.dailyRate),
        monthlyRate: numOrNull(input.monthlyRate),
        createdAt: input.createdAt ?? new Date().toISOString().slice(0, 10),
        paidUntil: input.paidUntil ?? '',
        notes: input.notes ?? '',
        userOverrides: input.userOverrides && Array.isArray(input.userOverrides)
          ? JSON.stringify(input.userOverrides)
          : '[]',
        customData: serializeCustomData(input.customData),
      })
      .run()
    return this.get(finalId)!
  },

  update(id: string, input: VpsInput): VpsDto | undefined {
    const db = getDb()
    const existing = getDb()
      .select()
      .from(schema.vps)
      .where(and(eq(schema.vps.id, id), spaceFilter()))
      .get()
    if (!existing) return undefined

    let userOverrides: string[] = []
    try {
      userOverrides = existing.userOverrides ? JSON.parse(existing.userOverrides) : []
    } catch {
      userOverrides = []
    }
    const clearOverrides = input.userOverrides === 'clear'
    if (clearOverrides) userOverrides = []

    const additionalIps = Array.isArray(input.additionalIps) ? JSON.stringify(input.additionalIps) : '[]'

    let projectOut = existing.project ?? ''
    let projectIdOut = existing.projectId ?? ''
    if (input.project !== undefined) {
      const r = projectColumnsForSave(input.project)
      projectOut = r.project
      projectIdOut = r.projectId
    } else if (input.projectId !== undefined) {
      if (!input.projectId) {
        projectOut = ''
        projectIdOut = ''
      } else {
        projectOut = getProjectNameById(input.projectId)
        projectIdOut = input.projectId
      }
    }

    if (!clearOverrides) {
      for (const f of USER_OVERRIDABLE_FIELDS) {
        if (f === 'project') {
          const projectChanged =
            String(projectOut ?? '') !== String(existing.project ?? '') ||
            String(projectIdOut ?? '') !== String(existing.projectId ?? '')
          if (projectChanged && !userOverrides.includes('project')) {
            userOverrides.push('project')
          }
          continue
        }
        const newVal = (input as Record<string, unknown>)[f]
        const oldVal = (existing as Record<string, unknown>)[f]
        const changed =
          f === 'dailyRate' || f === 'monthlyRate'
            ? normNum(newVal) !== normNum(oldVal)
            : String(newVal ?? '') !== String(oldVal ?? '')
        if (changed && !userOverrides.includes(f)) {
          userOverrides.push(f)
        }
      }
    }
    const userOverridesJson = JSON.stringify([...new Set(userOverrides)])

    db.update(schema.vps)
      .set({
        ip: input.ip ?? '',
        ipv6: input.ipv6 ?? '',
        additionalIps,
        dns: input.dns ?? '',
        providerId: input.providerId ?? '',
        providerAccountId: input.providerAccountId ?? '',
        country: input.country ?? '',
        city: input.city ?? '',
        datacenter: input.datacenter ?? '',
        os: input.os ?? '',
        vcpu: input.vcpu ?? 0,
        ramGb: input.ramGb ?? 0,
        diskGb: input.diskGb ?? 0,
        diskType: input.diskType ?? '',
        virtualization: input.virtualization ?? '',
        bandwidthTb: input.bandwidthTb ?? 0,
        sshPort: input.sshPort ?? 22,
        rootUser: input.rootUser ?? '',
        purpose: input.purpose ?? '',
        environment: input.environment ?? '',
        project: projectOut,
        projectId: projectIdOut || null,
        monitoringEnabled: boolToInt(input.monitoringEnabled),
        backupEnabled: boolToInt(input.backupEnabled),
        status: input.status ?? 'active',
        tariffType: input.tariffType ?? '',
        currency: input.currency ?? '',
        dailyRate: numOrNull(input.dailyRate),
        monthlyRate: numOrNull(input.monthlyRate),
        createdAt: input.createdAt ?? '',
        paidUntil: input.paidUntil ?? '',
        notes: input.notes ?? '',
        userOverrides: userOverridesJson,
        spaceId: existing.spaceId,
        ...(input.customData !== undefined
          ? { customData: serializeCustomData(input.customData) }
          : {}),
      })
      .where(and(eq(schema.vps.id, id), eq(schema.vps.spaceId, existing.spaceId)))
      .run()
    return this.get(id)
  },

  /** Update VPS by id regardless of current space (for shared write grants). */
  updateAnySpace(id: string, input: VpsInput): VpsDto | undefined {
    const existing = getDb().select().from(schema.vps).where(eq(schema.vps.id, id)).get()
    if (!existing) return undefined
    // Temporarily treat as owned update in its home space via raw set of fields
    const additionalIps = Array.isArray(input.additionalIps)
      ? JSON.stringify(input.additionalIps)
      : existing.additionalIps ?? '[]'

    let projectOut = existing.project ?? ''
    let projectIdOut = existing.projectId ?? ''
    if (input.project !== undefined) {
      const r = projectColumnsForSave(input.project)
      projectOut = r.project
      projectIdOut = r.projectId
    }

    getDb()
      .update(schema.vps)
      .set({
        ip: input.ip ?? existing.ip ?? '',
        ipv6: input.ipv6 ?? existing.ipv6 ?? '',
        additionalIps,
        dns: input.dns ?? existing.dns ?? '',
        country: input.country ?? existing.country ?? '',
        city: input.city ?? existing.city ?? '',
        datacenter: input.datacenter ?? existing.datacenter ?? '',
        os: input.os ?? existing.os ?? '',
        vcpu: input.vcpu ?? existing.vcpu ?? 0,
        ramGb: input.ramGb ?? existing.ramGb ?? 0,
        diskGb: input.diskGb ?? existing.diskGb ?? 0,
        diskType: input.diskType ?? existing.diskType ?? '',
        virtualization: input.virtualization ?? existing.virtualization ?? '',
        bandwidthTb: input.bandwidthTb ?? existing.bandwidthTb ?? 0,
        sshPort: input.sshPort ?? existing.sshPort ?? 22,
        rootUser: input.rootUser ?? existing.rootUser ?? '',
        purpose: input.purpose ?? existing.purpose ?? '',
        environment: input.environment ?? existing.environment ?? '',
        project: projectOut,
        projectId: projectIdOut || null,
        monitoringEnabled:
          input.monitoringEnabled !== undefined
            ? boolToInt(input.monitoringEnabled)
            : existing.monitoringEnabled,
        backupEnabled:
          input.backupEnabled !== undefined
            ? boolToInt(input.backupEnabled)
            : existing.backupEnabled,
        status: input.status ?? existing.status ?? 'active',
        tariffType: input.tariffType ?? existing.tariffType ?? '',
        currency: input.currency ?? existing.currency ?? '',
        dailyRate:
          input.dailyRate !== undefined ? numOrNull(input.dailyRate) : existing.dailyRate,
        monthlyRate:
          input.monthlyRate !== undefined ? numOrNull(input.monthlyRate) : existing.monthlyRate,
        paidUntil: input.paidUntil ?? existing.paidUntil ?? '',
        notes: input.notes ?? existing.notes ?? '',
        // Do not change providerAccountId / providerId / spaceId on shared edit
      })
      .where(eq(schema.vps.id, id))
      .run()
    return this.getAnySpace(id)
  },

  assignToSpace(id: string, toSpaceId: string): VpsDto | undefined {
    const existing = getDb().select().from(schema.vps).where(eq(schema.vps.id, id)).get()
    if (!existing) return undefined
    getDb()
      .update(schema.vps)
      .set({
        spaceId: toSpaceId,
        providerId: null,
        providerAccountId: null,
        projectId: null,
        project: '',
      })
      .where(eq(schema.vps.id, id))
      .run()
    return this.getAnySpace(id)
  },

  delete(id: string): boolean {
    const existing = getDb()
      .select()
      .from(schema.vps)
      .where(and(eq(schema.vps.id, id), spaceFilter()))
      .get()
    if (!existing) return false
    const r = getDb()
      .delete(schema.vps)
      .where(and(eq(schema.vps.id, id), eq(schema.vps.spaceId, existing.spaceId)))
      .run()
    return r.changes > 0
  },

  bulkStatus(ids: string[], status: string): number {
    const spaceId = getCurrentSpaceId()
    const owned = getDb()
      .select({ id: schema.vps.id })
      .from(schema.vps)
      .where(and(inArray(schema.vps.id, ids), eq(schema.vps.spaceId, spaceId)))
      .all()
      .map((r) => r.id)
    if (owned.length === 0) return 0
    getDb().update(schema.vps).set({ status }).where(inArray(schema.vps.id, owned)).run()
    return owned.length
  },

  bulkDelete(ids: string[]): number {
    const spaceId = getCurrentSpaceId()
    const r = getDb()
      .delete(schema.vps)
      .where(and(inArray(schema.vps.id, ids), eq(schema.vps.spaceId, spaceId)))
      .run()
    return r.changes
  },

  bulkProject(ids: string[], project: string | null): { updated: number; project: string; projectId: string } {
    const { project: projName, projectId: projId } = projectColumnsForSave(project ?? '')
    const spaceId = getCurrentSpaceId()
    const rows = getDb()
      .select()
      .from(schema.vps)
      .where(and(inArray(schema.vps.id, ids), eq(schema.vps.spaceId, spaceId)))
      .all()
    let updated = 0
    for (const row of rows) {
      if (String(row.project ?? '') === projName && String(row.projectId ?? '') === String(projId ?? '')) {
        continue
      }
      let userOverrides: string[] = []
      try {
        userOverrides = row.userOverrides ? JSON.parse(row.userOverrides) : []
      } catch {
        userOverrides = []
      }
      if (!userOverrides.includes('project')) userOverrides.push('project')
      getDb()
        .update(schema.vps)
        .set({
          project: projName,
          projectId: projId || null,
          userOverrides: JSON.stringify([...new Set(userOverrides)]),
        })
        .where(eq(schema.vps.id, row.id))
        .run()
      updated++
    }
    return { updated, project: projName, projectId: projId }
  },
}
