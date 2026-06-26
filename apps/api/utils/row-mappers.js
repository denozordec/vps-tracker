/**
 * Map database rows to API response format
 */

/**
 * @param {object} row - provider_account row
 * @returns {object} sanitized (apiCredentials hidden)
 */
export function sanitizeAccount(row) {
  if (!row) return row
  const { apiCredentials, ...rest } = row
  return { ...rest, apiCredentialsSet: Boolean(apiCredentials) }
}

/**
 * @param {object} row - active_tariffs row
 * @returns {object|null}
 */
export function rowToActiveTariff(row) {
  if (!row) return null
  return {
    ...row,
    orderAvailable: Boolean(row.orderAvailable),
    ramGb: row.ramGb != null ? Number(row.ramGb) : 0,
  }
}

/**
 * @param {object} row - tariff_sync_options row
 * @returns {object|null}
 */
export function rowToTariffSyncOptions(row) {
  if (!row) return null
  let datacenters = []
  let periods = []
  try {
    datacenters = row.datacenters ? JSON.parse(row.datacenters) : []
  } catch {
    /* ignore parse error */
  }
  try {
    periods = row.periods ? JSON.parse(row.periods) : []
  } catch {
    /* ignore parse error */
  }
  return {
    ...row,
    datacenters: Array.isArray(datacenters) ? datacenters : [],
    periods: Array.isArray(periods) ? periods : [],
  }
}
