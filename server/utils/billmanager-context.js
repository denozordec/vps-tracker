/**
 * BILLmanager: URL и тип API задаются на хостере (providers), учётные данные — на аккаунте.
 * Поддержка fallback на поля аккаунта для старых данных до миграции.
 */

/**
 * @param {object|null|undefined} accountRow
 * @param {object|null|undefined} providerRow
 * @returns {{ apiType: string, apiBaseUrl: string }}
 */
export function resolveBillmanagerApi(accountRow, providerRow) {
  const apiType = String(providerRow?.apiType || accountRow?.apiType || '').trim()
  const apiBaseUrl = String(providerRow?.apiBaseUrl || accountRow?.apiBaseUrl || '').trim()
  return { apiType, apiBaseUrl }
}

/**
 * Объект аккаунта с подставленным URL для syncFromBillmanager / balance.
 * @param {object} accountRow
 * @param {object|null|undefined} providerRow
 * @returns {object|null} null если не готово к запросам API
 */
export function billmanagerAccountRowForSync(accountRow, providerRow) {
  if (!accountRow) return null
  const { apiType, apiBaseUrl } = resolveBillmanagerApi(accountRow, providerRow)
  const cred = String(accountRow.apiCredentials || '').trim()
  if (apiType !== 'billmanager' || !apiBaseUrl || !cred) return null
  return { ...accountRow, apiType: 'billmanager', apiBaseUrl }
}
