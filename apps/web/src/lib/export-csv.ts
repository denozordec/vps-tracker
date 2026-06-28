import { toCsv, downloadTextFile } from '@/lib/format'

export function exportVpsCsv(
  rows: Record<string, unknown>[],
  fileName = 'vps-export.csv',
): void {
  downloadTextFile(fileName, toCsv(rows))
}

export function exportActiveVpsCsv(
  vps: Array<{
    ip: string
    status: string
    project?: string
    currency: string
    monthlyRate?: number | null
  }>,
  fileName = 'vps-export.csv',
): void {
  exportVpsCsv(
    vps.map((v) => ({
      ip: v.ip,
      status: v.status,
      project: v.project ?? '',
      currency: v.currency,
      monthlyRate: v.monthlyRate ?? 0,
    })),
    fileName,
  )
}
