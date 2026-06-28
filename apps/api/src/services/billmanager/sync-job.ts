/**
 * Запуск синхронизации BILLmanager с записью в sync_log
 */

import type { BillmanagerSyncAccount } from './context.js'
import type { SyncFromBillmanagerOptions, SyncFromBillmanagerResult } from './sync.js'
import { billmanagerAdapter } from '../providers/billmanager-adapter.js'
import { runAccountSync } from '../providers/sync-job.js'

export interface RunBillmanagerAccountSyncResult extends SyncFromBillmanagerResult {
  ok: true
  logId: string
}

export async function runBillmanagerAccountSync(
  account: BillmanagerSyncAccount,
  opts: SyncFromBillmanagerOptions = {},
): Promise<RunBillmanagerAccountSyncResult> {
  return runAccountSync(billmanagerAdapter, account, opts)
}
