import { parseDatacenterName } from '../parsers.js'
import type { MappedVps } from '../mappers.js'
import type {
  BillmanagerMapOverrides,
  BillmanagerProfileOverrides,
} from './types.js'

/** BILLmanager daily billing usually divides monthly price by 30. */
export const FIRSTBYTE_DAYS_PER_MONTH = 30

/** YYYY-MM-DD only — skip labels like «Ежедневное списание». */
export function pickPaidUntilDate(item: Record<string, string>): string {
  for (const key of ['real_expiredate', 'expiredate'] as const) {
    const raw = String(item[key] ?? '').trim()
    const m = raw.match(/^(\d{4}-\d{2}-\d{2})/)
    if (m) return m[1]!
  }
  return ''
}

export function isFirstbyteDailyBilling(item: Record<string, string>): boolean {
  if (String(item.billdaily || '').toLowerCase() === 'on') return true
  const expire = String(item.expiredate || '').trim()
  return /ежедневн/i.test(expire)
}

/** Parse «129.00 RUB / Месяц» or item_cost → monthly amount. */
export function parseFirstbyteMonthlyCost(item: Record<string, string>): number {
  const fromCost = parseFloat(
    String(item.cost || '')
      .replace(/[^\d.,-]/g, '')
      .replace(',', '.'),
  )
  if (Number.isFinite(fromCost) && fromCost > 0) return fromCost
  const fromItem = parseFloat(String(item.item_cost || '').replace(',', '.'))
  return Number.isFinite(fromItem) && fromItem > 0 ? fromItem : 0
}

export function monthlyToDailyRate(monthly: number): number {
  if (!monthly || monthly <= 0) return 0
  return Math.round((monthly / FIRSTBYTE_DAYS_PER_MONTH) * 10000) / 10000
}

function addDaysIso(from: Date, days: number): string {
  const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()))
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/**
 * Shared account balance ÷ sum(dailyRate of all daily VPS) → same paidUntil for each.
 * Monthly VPS are left unchanged.
 */
export function applyFirstbyteSharedDailyPaidUntil(
  list: MappedVps[],
  balance: number | null | undefined,
  asOf: Date = new Date(),
): MappedVps[] {
  const dailyOnes = list.filter((v) => v.tariffType === 'daily')
  if (dailyOnes.length === 0) return list

  const totalDaily = dailyOnes.reduce((sum, v) => sum + (Number(v.dailyRate) || 0), 0)
  const bal = typeof balance === 'number' && Number.isFinite(balance) ? balance : 0

  let paidUntil = ''
  if (totalDaily > 0 && bal > 0) {
    const daysLeft = Math.floor(bal / totalDaily)
    paidUntil = addDaysIso(asOf, daysLeft)
  } else if (totalDaily > 0) {
    // Нет средств — считаем оплаченным до сегодня (0 полных дней)
    paidUntil = addDaysIso(asOf, 0)
  }

  if (!paidUntil) return list

  return list.map((v) =>
    v.tariffType === 'daily' ? { ...v, paidUntil } : v,
  )
}

/** Disk / virt hints from FirstByte tariff codes (MSK-KVM-SSD-START, KVM-SAS-1). */
export function inferFirstbyteHardwareHints(item: Record<string, string>): {
  diskType?: string
  virtualization?: string
} {
  const hay = `${item.pricelist || ''} ${item.intname || ''} ${item.name || ''}`
  let diskType: string | undefined
  let virtualization: string | undefined
  if (/\bNVMe\b/i.test(hay)) diskType = 'NVMe'
  else if (/\bSAS\b/i.test(hay)) diskType = 'SAS'
  else if (/\bHDD\b/i.test(hay)) diskType = 'HDD'
  else if (/\bSSD\b/i.test(hay)) diskType = 'SSD'
  if (/\bKVM\b/i.test(hay)) virtualization = 'KVM'
  else if (/\bOpenVZ\b/i.test(hay)) virtualization = 'OpenVZ'
  else if (/\bLXC\b/i.test(hay)) virtualization = 'LXC'
  return { diskType, virtualization }
}

/**
 * FirstByte — standard func=vds, but list has no CPU/RAM/disk numbers.
 *
 * Sync additionally fills specs via:
 * 1) vds.order match by pricelist_id (`enrichMappedVpsFromTariffs`)
 * 2) func=vds.edit&elid= (`options.fetchVdsEditForSpecs`)
 * 3) enrichVdsBatch: shared balance → paidUntil for daily VPS
 *
 * This enrich: geo, rates, daily flag, diskType/KVM from tariff name.
 * For daily: paidUntil left empty until enrichVdsBatch (shared balance).
 */
export function enrichFirstbyteVds(
  item: Record<string, string>,
  mapped: MappedVps,
): MappedVps {
  const dcRaw = (item.datacentername || item.datacenter || mapped.datacenter || '').trim()
  const { country, location } = parseDatacenterName(dcRaw)
  const daily = isFirstbyteDailyBilling(item)
  const monthly = parseFirstbyteMonthlyCost(item) || mapped.monthlyRate || 0
  const hints = inferFirstbyteHardwareHints(item)

  if (daily) {
    const dailyRate = monthlyToDailyRate(monthly) || mapped.dailyRate
    return {
      ...mapped,
      country: country || mapped.country,
      city: location || mapped.city,
      datacenter: dcRaw || mapped.datacenter,
      tariffType: 'daily',
      monthlyRate: monthly || mapped.monthlyRate,
      dailyRate,
      // Не брать real_expiredate — дата из общего баланса в enrichVdsBatch
      paidUntil: '',
      diskType: mapped.diskGb ? mapped.diskType : hints.diskType || mapped.diskType,
      virtualization: hints.virtualization || mapped.virtualization,
    }
  }

  const paidUntil = pickPaidUntilDate(item) || mapped.paidUntil
  return {
    ...mapped,
    country: country || mapped.country,
    city: location || mapped.city,
    datacenter: dcRaw || mapped.datacenter,
    paidUntil,
    tariffType: mapped.tariffType || 'monthly',
    monthlyRate: monthly || mapped.monthlyRate,
    dailyRate: null,
    diskType: mapped.diskGb ? mapped.diskType : hints.diskType || mapped.diskType,
    virtualization: hints.virtualization || mapped.virtualization,
  }
}

export function enrichFirstbyteVdsBatch(
  list: MappedVps[],
  ctx: { balance: number | null },
): MappedVps[] {
  return applyFirstbyteSharedDailyPaidUntil(list, ctx.balance)
}

const firstbyteMap: BillmanagerMapOverrides = {
  enrichVds: enrichFirstbyteVds,
  enrichVdsBatch: enrichFirstbyteVdsBatch,
}

export const firstbyteOverrides: BillmanagerProfileOverrides = {
  id: 'firstbyte',
  match: {
    hostnames: ['firstbyte.ru', 'firstbyte.club', '1byte.ru'],
    keywords: ['firstbyte'],
  },
  map: firstbyteMap,
  options: {
    fetchVdsEditForSpecs: true,
  },
}
