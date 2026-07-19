/**
 * Enrich VPS hardware specs when list `func=vds` has no CPU/RAM/disk
 * (typical for FirstByte: only pricelist / pricelist_id).
 */

import { billmanagerRequest } from './client.js'
import { elemToObject } from './parsers.js'
import type { MappedVps } from './mappers.js'

/** Minimal tariff shape for matching (from vds.order). */
export type TariffSpecsSource = {
  externalId: string
  name: string
  desc: string
  vcpu: number
  ramGb: number
  diskGb: number
  diskType: string
  virtualization: string
}

export function needsHardwareSpecs(mapped: MappedVps): boolean {
  return !mapped.vcpu || !mapped.ramGb || !mapped.diskGb
}

/** Match VDS list row → tariff from vds.order by pricelist_id / name. */
export function findTariffForVdsItem(
  item: Record<string, string>,
  tariffs: TariffSpecsSource[],
): TariffSpecsSource | undefined {
  if (!tariffs.length) return undefined

  const id = String(item.pricelist_id || '').trim()
  if (id) {
    const byId = tariffs.find((t) => String(t.externalId) === id)
    if (byId && (byId.vcpu || byId.ramGb || byId.diskGb)) return byId
  }

  const names = [
    String(item.pricelist || '').trim(),
    String(item.intname || '').trim(),
  ].filter(Boolean)

  for (const raw of names) {
    const needle = raw.toLowerCase()
    const hit = tariffs.find((t) => {
      if (t.vcpu || t.ramGb || t.diskGb) {
        const tName = (t.name || '').toLowerCase()
        const tDesc = (t.desc || '').toLowerCase()
        return (
          tName === needle ||
          tName.includes(needle) ||
          needle.includes(tName) ||
          tDesc.includes(needle)
        )
      }
      return false
    })
    if (hit) return hit
  }

  // Same id even if specs empty (caller may still use name hints)
  if (id) return tariffs.find((t) => String(t.externalId) === id)
  return undefined
}

export function applyTariffSpecs(mapped: MappedVps, tariff: TariffSpecsSource): MappedVps {
  return {
    ...mapped,
    vcpu: mapped.vcpu || tariff.vcpu || 0,
    ramGb: mapped.ramGb || tariff.ramGb || 0,
    diskGb: mapped.diskGb || tariff.diskGb || 0,
    diskType:
      mapped.diskGb && mapped.diskType
        ? mapped.diskType
        : tariff.diskType || mapped.diskType,
    virtualization: mapped.virtualization || tariff.virtualization || 'KVM',
  }
}

export function enrichMappedVpsFromTariffs(
  item: Record<string, string>,
  mapped: MappedVps,
  tariffs: TariffSpecsSource[],
): MappedVps {
  if (!needsHardwareSpecs(mapped)) return mapped
  const tariff = findTariffForVdsItem(item, tariffs)
  return tariff ? applyTariffSpecs(mapped, tariff) : mapped
}

function flattenModel(data: Record<string, unknown>): Record<string, string> {
  const raw =
    (data.model as Record<string, unknown> | undefined) ??
    ((data.doc as Record<string, unknown> | undefined)?.model as
      | Record<string, unknown>
      | undefined) ??
    data
  return elemToObject(raw)
}

function parseRamToGb(raw: string): number {
  const s = String(raw || '').trim()
  if (!s) return 0
  const n = parseFloat(s.replace(/[^\d.]/g, ''))
  if (!Number.isFinite(n) || n <= 0) return 0
  // BM often stores RAM in MB for addons
  if (/mb/i.test(s) || (!/gb/i.test(s) && n >= 128)) {
    return Math.max(0.5, Math.round((n / 1024) * 10) / 10)
  }
  return n
}

function parseDiskGb(raw: string): number {
  const n = parseFloat(String(raw || '').replace(/[^\d.]/g, ''))
  return Number.isFinite(n) && n > 0 ? n : 0
}

function labelForAddon(
  key: string,
  data: Record<string, unknown>,
): string {
  const messages = data.messages ?? (data.doc as Record<string, unknown> | undefined)?.messages
  if (Array.isArray(messages)) {
    for (const m of messages) {
      if (!m || typeof m !== 'object') continue
      const row = m as Record<string, unknown>
      const name = String(row.name ?? row.k ?? '')
      if (name === key || name.endsWith(key)) {
        return String(row.msg ?? row.v ?? row.$ ?? '')
      }
    }
  }
  // metadata on fields sometimes: metadata.addon_N
  const meta = data.metadata as Record<string, unknown> | undefined
  if (meta && typeof meta[key] === 'object' && meta[key]) {
    const m = meta[key] as Record<string, unknown>
    return String(m.label ?? m.name ?? m.msg ?? '')
  }
  return ''
}

/** Parse CPU/RAM/disk from `func=vds.edit&elid=` form response. */
export function parseSpecsFromVdsEdit(
  data: Record<string, unknown>,
): Pick<MappedVps, 'vcpu' | 'ramGb' | 'diskGb' | 'diskType' | 'virtualization'> {
  const model = flattenModel(data)
  let vcpu = 0
  let ramGb = 0
  let diskGb = 0
  let diskType = ''
  let virtualization = ''

  for (const key of ['ncpu', 'cpu', 'vcpu', 'cpus', 'cpu_count'] as const) {
    const n = parseInt(String(model[key] || ''), 10)
    if (n > 0) {
      vcpu = n
      break
    }
  }
  for (const key of ['ram', 'memory', 'mem', 'ram_mb', 'ram_gb'] as const) {
    if (model[key]) {
      ramGb = parseRamToGb(model[key]!)
      if (ramGb) break
    }
  }
  for (const key of ['disc', 'disk', 'hdd', 'disksize', 'disk_gb', 'hdd_gb'] as const) {
    if (model[key]) {
      diskGb = parseDiskGb(model[key]!)
      if (diskGb) break
    }
  }

  for (const [key, val] of Object.entries(model)) {
    if (!key.startsWith('addon_') || !val) continue
    const label = labelForAddon(key, data).toLowerCase()
    const n = parseFloat(String(val).replace(/[^\d.]/g, ''))
    if (!Number.isFinite(n) || n <= 0) continue

    if (/ядер|процессор|cpu|v?cpu|core/i.test(label) && !vcpu) {
      vcpu = Math.round(n)
    } else if (/память|memory|ram|озу/i.test(label) && !ramGb) {
      ramGb = parseRamToGb(String(val))
    } else if (/диск|disk|hdd|ssd|nvme|sas|хранилище/i.test(label) && !diskGb) {
      diskGb = parseDiskGb(String(val))
      if (/nvme/i.test(label)) diskType = 'NVMe'
      else if (/sas/i.test(label)) diskType = 'SAS'
      else if (/hdd/i.test(label)) diskType = 'HDD'
      else if (/ssd/i.test(label)) diskType = 'SSD'
    }
  }

  const hay = `${model.pricelist || ''} ${model.intname || ''} ${model.name || ''}`
  if (/\bKVM\b/i.test(hay)) virtualization = 'KVM'
  else if (/\bOpenVZ\b/i.test(hay)) virtualization = 'OpenVZ'
  else if (/\bLXC\b/i.test(hay)) virtualization = 'LXC'
  if (!diskType) {
    if (/\bNVMe\b/i.test(hay)) diskType = 'NVMe'
    else if (/\bSAS\b/i.test(hay)) diskType = 'SAS'
    else if (/\bHDD\b/i.test(hay)) diskType = 'HDD'
    else if (/\bSSD\b/i.test(hay)) diskType = 'SSD'
  }

  return {
    vcpu,
    ramGb,
    diskGb,
    diskType: diskType || 'SSD',
    virtualization: virtualization || 'KVM',
  }
}

export function applyEditSpecs(
  mapped: MappedVps,
  specs: ReturnType<typeof parseSpecsFromVdsEdit>,
): MappedVps {
  return {
    ...mapped,
    vcpu: mapped.vcpu || specs.vcpu || 0,
    ramGb: mapped.ramGb || specs.ramGb || 0,
    diskGb: mapped.diskGb || specs.diskGb || 0,
    diskType: mapped.diskGb ? mapped.diskType : specs.diskType || mapped.diskType,
    virtualization: mapped.virtualization || specs.virtualization || 'KVM',
  }
}

export async function fetchVdsEditSpecs(
  baseUrl: string,
  authinfo: string,
  elid: string,
): Promise<ReturnType<typeof parseSpecsFromVdsEdit> | null> {
  const id = String(elid || '').trim()
  if (!id) return null
  try {
    const data = await billmanagerRequest(baseUrl, authinfo, 'vds.edit', { elid: id })
    const specs = parseSpecsFromVdsEdit(data)
    if (!specs.vcpu && !specs.ramGb && !specs.diskGb) return null
    return specs
  } catch (err) {
    console.warn(
      'fetchVdsEditSpecs failed:',
      id,
      err instanceof Error ? err.message : err,
    )
    return null
  }
}
