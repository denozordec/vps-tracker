/**
 * Подпись аккаунта в select и списках: при выборе одного хостера (scopedProviderId) — только имя аккаунта,
 * иначе «хостер / аккаунт» (как в фильтрах VPS).
 * @param {{ name?: string, providerId?: string }} account
 * @param {Map<string, { name?: string }>} providerById
 * @param {string} [scopedProviderId]
 */
export function accountSelectLabel(account, providerById, scopedProviderId) {
  const name = account.name?.trim() || '—'
  if (scopedProviderId) return name
  const providerName = providerById.get(account.providerId)?.name ?? '—'
  return `${providerName} / ${name}`
}
