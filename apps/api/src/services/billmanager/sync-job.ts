/**
 * Запуск синхронизации BILLmanager с записью в sync_log
 */

import type { BillmanagerSyncAccount } from './context.js'
import type { SyncFromBillmanagerOptions } from './sync.js'
import { billmanagerAdapter } from '../providers/billmanager-adapter.js'
import { runAccountSync, type RunAccountSyncResult } from '../providers/sync-job.js'

export type RunBillmanagerAccountSyncResult = RunAccountSyncResult

export async function runBillmanagerAccountSync(
  account: BillmanagerSyncAccount,
  opts: SyncFromBillmanagerOptions = {},
): Promise<RunAccountSyncResult> {
  return runAccountSync(billmanagerAdapter, account, opts)
}
