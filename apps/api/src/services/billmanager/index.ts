/**
 * BILLmanager 6 API adapter
 * @see https://www.ispsystem.com/docs/b6c/developer-section/working-with-api/guide-to-ispsystem-software-api
 */

export {
  testConnection,
  fetchVds,
  fetchDashboardInfo,
  fetchPayments,
  fetchVdsOrderPricelist,
  fetchVdsOrderPricelistAllDatacenters,
} from './operations.js'
export { syncFromBillmanager } from './sync.js'
export { runBillmanagerAccountSync } from './sync-job.js'
export { billmanagerAccountRowForSync, resolveBillmanagerApi } from './context.js'
export type { BillmanagerSyncAccount } from './context.js'
export type {
  SyncFromBillmanagerOptions,
  SyncFromBillmanagerResult,
  SyncSummary,
} from './sync.js'
