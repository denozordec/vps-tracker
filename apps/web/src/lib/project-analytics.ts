import type {
  DataSnapshot,
  Payment,
  Provider,
  RatesData,
  ServerProject,
  Settings,
  Vps,
} from '@/types/entities'
import { convertVpsMonthlyBurnToBase, monthKey } from '@/lib/format'
import { providerByIdMap } from '@/lib/billmanager'

export const NO_PROJECT_KEY = '__none__'

export type ReportsPeriod = '3m' | '6m' | '12m' | 'all'

export interface ProjectRow {
  id: string
  name: string
  color?: string | null
  notes?: string | null
  createdAt?: string
  vpsTotal: number
  vpsActive: number
  monthlyBurn: number
  vcpu: number
  ramGb: number
  diskGb: number
}

export interface ProjectAnalyticsContext {
  providers: Provider[]
  settings: Settings[]
  ratesData: RatesData | null
}

export function vpsBelongsToProject(
  vps: Pick<Vps, 'project' | 'projectId'>,
  project: Pick<ServerProject, 'id' | 'name'>,
): boolean {
  if (vps.projectId && vps.projectId === project.id) return true
  const name = (vps.project ?? '').trim()
  return name !== '' && name.toLowerCase() === project.name.toLowerCase()
}

export function vpsHasNoProject(vps: Pick<Vps, 'project' | 'projectId'>): boolean {
  return !(vps.projectId ?? '').trim() && !(vps.project ?? '').trim()
}

export function resolveProjectFilterKeys(
  keys: string[],
  projects: ServerProject[],
): { projectIds: string[]; includeNoProject: boolean } {
  const projectIds: string[] = []
  let includeNoProject = false
  for (const key of keys) {
    if (key === NO_PROJECT_KEY) {
      includeNoProject = true
      continue
    }
    const byId = projects.find((p) => p.id === key)
    if (byId) {
      projectIds.push(byId.id)
      continue
    }
    const byName = projects.find((p) => p.name.toLowerCase() === key.toLowerCase())
    if (byName) projectIds.push(byName.id)
  }
  return { projectIds: [...new Set(projectIds)], includeNoProject }
}

export function projectKeysFromSearch(
  project: string | string[] | undefined,
  projects: ServerProject[],
): string[] {
  if (!project) return []
  const raw = Array.isArray(project) ? project : [project]
  const keys: string[] = []
  for (const item of raw) {
    const trimmed = item.trim()
    if (!trimmed) continue
    if (trimmed === NO_PROJECT_KEY || trimmed.toLowerCase() === 'без проекта') {
      keys.push(NO_PROJECT_KEY)
      continue
    }
    const match = projects.find((p) => p.name.toLowerCase() === trimmed.toLowerCase())
    keys.push(match?.id ?? trimmed)
  }
  return [...new Set(keys)]
}

export function filterVpsByProjectKeys(
  vpsList: Vps[],
  keys: string[],
  projects: ServerProject[],
): Vps[] {
  if (!keys.length) return vpsList
  const { projectIds, includeNoProject } = resolveProjectFilterKeys(keys, projects)
  const selected = projectIds
    .map((id) => projects.find((p) => p.id === id))
    .filter((p): p is ServerProject => Boolean(p))

  return vpsList.filter((v) => {
    if (includeNoProject && vpsHasNoProject(v)) return true
    return selected.some((p) => vpsBelongsToProject(v, p))
  })
}

export function filterPaymentsByProjectKeys(
  payments: Payment[],
  vpsById: Map<string, Vps>,
  keys: string[],
  projects: ServerProject[],
): Payment[] {
  if (!keys.length) return payments
  const allowedVpsIds = new Set(
    filterVpsByProjectKeys(Array.from(vpsById.values()), keys, projects).map((v) => v.id),
  )
  return payments.filter((p) => p.vpsId && allowedVpsIds.has(p.vpsId))
}

export function filterPaymentsByPeriod(
  payments: Payment[],
  period: ReportsPeriod,
): Payment[] {
  if (period === 'all') return payments
  const months = period === '3m' ? 3 : period === '6m' ? 6 : 12
  const cutoff = new Date()
  cutoff.setMonth(cutoff.getMonth() - months)
  cutoff.setHours(0, 0, 0, 0)
  return payments.filter((p) => {
    const date = new Date(p.date)
    return !Number.isNaN(date.getTime()) && date >= cutoff
  })
}

export function sumVpsMonthlyBurn(
  vpsList: Vps[],
  ctx: ProjectAnalyticsContext,
): number {
  const providerById = providerByIdMap(ctx.providers)
  return vpsList.reduce(
    (acc, v) =>
      acc + convertVpsMonthlyBurnToBase(v, providerById.get(v.providerId), ctx.settings, ctx.ratesData),
    0,
  )
}

export function sumVpsResources(vpsList: Vps[]): { vcpu: number; ramGb: number; diskGb: number } {
  return vpsList.reduce(
    (acc, v) => ({
      vcpu: acc.vcpu + Number(v.vcpu || 0),
      ramGb: acc.ramGb + Number(v.ramGb || 0),
      diskGb: acc.diskGb + Number(v.diskGb || 0),
    }),
    { vcpu: 0, ramGb: 0, diskGb: 0 },
  )
}

export function buildProjectRows(
  snapshot: DataSnapshot,
  ctx: ProjectAnalyticsContext,
): ProjectRow[] {
  const projects = (snapshot.serverProjects ?? []) as ServerProject[]
  return projects.map((project) => {
    const projectVps = snapshot.vps.filter((v) => vpsBelongsToProject(v, project))
    const active = projectVps.filter((v) => v.status === 'active')
    const resources = sumVpsResources(active)
    return {
      id: project.id,
      name: project.name,
      color: project.color,
      notes: project.notes,
      createdAt: project.createdAt,
      vpsTotal: projectVps.length,
      vpsActive: active.length,
      monthlyBurn: sumVpsMonthlyBurn(active, ctx),
      ...resources,
    }
  })
}

export function projectVpsList(snapshot: DataSnapshot, projectId: string): Vps[] {
  const project = (snapshot.serverProjects ?? []).find(
    (p) => (p as ServerProject).id === projectId,
  ) as ServerProject | undefined
  if (!project) return []
  return snapshot.vps.filter((v) => vpsBelongsToProject(v, project))
}

export function findProject(snapshot: DataSnapshot, projectId: string): ServerProject | undefined {
  return (snapshot.serverProjects ?? []).find((p) => (p as ServerProject).id === projectId) as
    | ServerProject
    | undefined
}

export function aggregateBurnByProject(
  vpsList: Vps[],
  projects: ServerProject[],
  ctx: ProjectAnalyticsContext,
  limit = 10,
): { key: string; name: string; expense: number; color?: string | null }[] {
  const providerById = providerByIdMap(ctx.providers)
  const byKey = new Map<string, { name: string; expense: number; color?: string | null }>()

  for (const v of vpsList) {
    if (v.status !== 'active') continue
    const burn = convertVpsMonthlyBurnToBase(
      v,
      providerById.get(v.providerId),
      ctx.settings,
      ctx.ratesData,
    )
    if (burn <= 0) continue

    const matched = projects.find((p) => vpsBelongsToProject(v, p))
    const key = matched?.id ?? NO_PROJECT_KEY
    const name = matched?.name ?? 'Без проекта'
    const color = matched?.color
    const entry = byKey.get(key) ?? { name, expense: 0, color }
    entry.expense += burn
    byKey.set(key, entry)
  }

  return Array.from(byKey.entries())
    .map(([key, row]) => ({ key, ...row, expense: Math.round(row.expense) }))
    .filter((row) => row.expense > 0)
    .sort((a, b) => b.expense - a.expense)
    .slice(0, limit)
}

export function latestPaymentDate(payments: Payment[]): string | null {
  let latest: string | null = null
  for (const p of payments) {
    if (!latest || p.date > latest) latest = p.date
  }
  return latest
}

export function paymentsForVpsIds(payments: Payment[], vpsIds: Set<string>): Payment[] {
  return payments.filter((p) => p.vpsId && vpsIds.has(p.vpsId))
}

export function projectsOverview(snapshot: DataSnapshot, ctx: ProjectAnalyticsContext) {
  const projects = (snapshot.serverProjects ?? []) as ServerProject[]
  const assigned = snapshot.vps.filter((v) => !vpsHasNoProject(v))
  const unassigned = snapshot.vps.length - assigned.length
  const activeInProjects = assigned.filter((v) => v.status === 'active')
  return {
    projectCount: projects.length,
    vpsInProjects: assigned.length,
    vpsUnassigned: unassigned,
    activeInProjects: activeInProjects.length,
    monthlyBurnInProjects: sumVpsMonthlyBurn(activeInProjects, ctx),
  }
}

export function vpsByIdMap(vpsList: Vps[]): Map<string, Vps> {
  return new Map(vpsList.map((v) => [v.id, v]))
}

export function periodLabel(period: ReportsPeriod): string {
  switch (period) {
    case '3m':
      return '3 месяца'
    case '6m':
      return '6 месяцев'
    case '12m':
      return '12 месяцев'
    default:
      return 'Всё время'
  }
}

export function paymentsInTrendWindow(payments: Payment[], period: ReportsPeriod): Payment[] {
  const filtered = filterPaymentsByPeriod(payments, period)
  if (period === 'all') {
    const byMonth = new Map<string, number>()
    for (const p of filtered) {
      const key = monthKey(p.date)
      if (key) byMonth.set(key, (byMonth.get(key) ?? 0) + 1)
    }
    const months = Array.from(byMonth.keys()).sort()
    const last12 = months.slice(-12)
    if (!last12.length) return filtered
    const minMonth = last12[0]!
    return filtered.filter((p) => {
      const key = monthKey(p.date)
      return key >= minMonth
    })
  }
  return filtered
}
