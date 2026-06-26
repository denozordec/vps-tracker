import { desc, eq, inArray } from 'drizzle-orm'
import { getDb, schema } from '../index.js'
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
}

const USER_OVERRIDABLE_FIELDS = [
  'country', 'city', 'datacenter', 'os', 'vcpu', 'ramGb', 'diskGb', 'diskType',
  'virtualization', 'purpose', 'environment', 'project', 'notes', 'sshPort',
  'rootUser', 'bandwidthTb', 'monitoringEnabled', 'backupEnabled',
] as const

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

export const vpsRepository = {
  list(): VpsDto[] {
    const rows = getDb().select().from(schema.vps).orderBy(desc(schema.vps.createdAt)).all()
    return rows.map((r) => toDto(r)!) as VpsDto[]
  },

  get(id: string): VpsDto | undefined {
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
      })
      .run()
    return this.get(finalId)!
  },

  update(id: string, input: VpsInput): VpsDto | undefined {
    const db = getDb()
    const existing = getDb().select().from(schema.vps).where(eq(schema.vps.id, id)).get()
    if (!existing) return undefined

    let userOverrides: string[] = []
    try {
      userOverrides = existing.userOverrides ? JSON.parse(existing.userOverrides) : []
    } catch {
      userOverrides = []
    }
    const clearOverrides =
      input.userOverrides === 'clear' ||
      (Array.isArray(input.userOverrides) && input.userOverrides.length === 0)
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
        const changed = String(newVal ?? '') !== String(oldVal ?? '')
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
      })
      .where(eq(schema.vps.id, id))
      .run()
    return this.get(id)
  },

  delete(id: string): boolean {
    const r = getDb().delete(schema.vps).where(eq(schema.vps.id, id)).run()
    return r.changes > 0
  },

  bulkStatus(ids: string[], status: string): number {
    getDb().update(schema.vps).set({ status }).where(inArray(schema.vps.id, ids)).run()
    return ids.length
  },

  bulkDelete(ids: string[]): number {
    const r = getDb().delete(schema.vps).where(inArray(schema.vps.id, ids)).run()
    return r.changes
  },

  bulkProject(ids: string[], project: string | null): { updated: number; project: string; projectId: string } {
    const { project: projName, projectId: projId } = projectColumnsForSave(project ?? '')
    const rows = getDb()
      .select()
      .from(schema.vps)
      .where(inArray(schema.vps.id, ids))
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
