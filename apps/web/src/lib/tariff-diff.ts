import type { ActiveTariff, Vps } from '@/types/entities'

export interface TariffVpsDiff {
  vpsId: string
  vpsLabel: string
  tariffName: string
  issues: string[]
}

function normName(s: string | null | undefined): string {
  return (s || '').trim().toLowerCase()
}

export function findMatchingTariff(
  vps: Vps,
  tariffs: ActiveTariff[],
): ActiveTariff | undefined {
  const byName = tariffs.filter(
    (t) =>
      t.providerAccountId === vps.providerAccountId &&
      normName(t.name) === normName(vps.tariffType),
  )
  if (byName.length === 1) return byName[0]
  return tariffs.find(
    (t) =>
      t.providerAccountId === vps.providerAccountId &&
      t.vcpu === vps.vcpu &&
      t.ramGb === vps.ramGb &&
      t.diskGb === vps.diskGb,
  )
}

export function computeTariffDiffs(vpsList: Vps[], tariffs: ActiveTariff[]): TariffVpsDiff[] {
  const active = vpsList.filter((v) => v.status === 'active')
  const out: TariffVpsDiff[] = []
  for (const v of active) {
    const tariff = findMatchingTariff(v, tariffs)
    if (!tariff) continue
    const issues: string[] = []
    if (tariff.vcpu != null && v.vcpu !== tariff.vcpu) {
      issues.push(`vCPU: факт ${v.vcpu}, тариф ${tariff.vcpu}`)
    }
    if (tariff.ramGb != null && Number(v.ramGb) !== Number(tariff.ramGb)) {
      issues.push(`RAM: факт ${v.ramGb} GB, тариф ${tariff.ramGb} GB`)
    }
    if (tariff.diskGb != null && v.diskGb !== tariff.diskGb) {
      issues.push(`Disk: факт ${v.diskGb} GB, тариф ${tariff.diskGb} GB`)
    }
    if (issues.length) {
      out.push({
        vpsId: v.id,
        vpsLabel: v.ip || v.dns || v.id,
        tariffName: tariff.name || String(tariff.pricelistId ?? ''),
        issues,
      })
    }
  }
  return out
}
