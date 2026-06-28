import type { SyncSummary } from '@/types/entities'

export {
  STALE_SYNC_HOURS,
  accountHasApiLedgerMismatch,
  lastOkSyncFinishedAt,
  computeInventoryHealth,
  countInventoryIssues,
  countExpiringWithin7Days,
  getStaleSyncAccountIds,
  getBalanceMismatchAccountIds,
  type InventoryIssue,
  type InventoryHealthInput,
} from '@cfdm/shared/utils/inventory-health'

export function formatSyncSummaryLine(summary: SyncSummary | null | undefined): string {
  if (!summary || typeof summary !== 'object') return ''
  if (summary.error) return String(summary.error)
  const parts: string[] = []
  if (summary.added?.length) parts.push(`+${summary.added.length} VPS`)
  if (summary.updated?.length) parts.push(`~${summary.updated.length} изм.`)
  if (summary.paymentsAdded) parts.push(`+${summary.paymentsAdded} платежей`)
  if (summary.tariffsOnly && summary.tariffsCount != null) parts.push(`тарифы: ${summary.tariffsCount}`)
  if (parts.length) return parts.join(', ')
  if (summary.vpsCount != null || summary.paymentsCount != null) {
    return `синк: VPS ${summary.vpsCount ?? 0}, платежи ${summary.paymentsCount ?? 0}`
  }
  return ''
}
