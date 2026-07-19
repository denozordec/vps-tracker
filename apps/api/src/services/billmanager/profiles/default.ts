import { mapPaymentToPayment, mapVdsToVps } from '../mappers.js'
import type { BillmanagerProfile } from './types.js'

/** Standard ISPsystem BILLmanager 6 behaviour. */
export const DEFAULT_PROFILE: BillmanagerProfile = {
  id: 'default',
  match: {},
  funcs: {
    listVds: 'vds',
    payments: 'payment',
    dashboard: 'dashboard.info',
    orderPricelist: 'vds.order',
  },
  extract: {
    listVdsKey: 'vds',
    paymentsKey: 'payment',
  },
  map: {
    vds: mapVdsToVps,
    payment: mapPaymentToPayment,
  },
  requestParams: {
    dashboard: {
      dashboard: 'info',
      sfrom: 'ajax',
    },
  },
}
