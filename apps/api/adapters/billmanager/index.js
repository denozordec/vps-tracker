/**
 * BILLmanager 6 API adapter
 * @see https://www.ispsystem.com/docs/b6c/developer-section/working-with-api/guide-to-ispsystem-software-api
 * @see https://www.ispsystem.com/docs/b6c/developer-section/billmanager-api/virtual-private-servers-vds
 * @see https://www.ispsystem.com/docs/b6c/developer-section/billmanager-api/payments-payment
 */

export { testConnection, fetchVds, fetchDashboardInfo, fetchPayments, fetchVdsOrderPricelist, fetchVdsOrderPricelistAllDatacenters } from './operations.js'
export { syncFromBillmanager } from './sync.js'
