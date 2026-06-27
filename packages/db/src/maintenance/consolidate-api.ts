import type Database from 'better-sqlite3'

function tryBillmgrUrl(raw: unknown): string {
  const t = String(raw || '').trim()
  if (!t || !/^https?:\/\//i.test(t) || !/billmgr/i.test(t)) return ''
  return t.replace(/\/+$/, '')
}

export function consolidateProviderApiFromAccounts(sqlite: Database.Database): void {
  const provRows = sqlite.prepare('SELECT id, apiType, apiBaseUrl FROM providers').all() as {
    id: string
    apiType: string | null
    apiBaseUrl: string | null
  }[]

  const accStmt = sqlite.prepare(
    `SELECT apiBaseUrl FROM provider_accounts
     WHERE providerId = ?
       AND length(trim(COALESCE(apiBaseUrl, ''))) > 0
       AND (
         lower(trim(COALESCE(apiType, ''))) = 'billmanager'
         OR instr(lower(trim(COALESCE(apiBaseUrl, ''))), 'billmgr') > 0
       )
     ORDER BY id`,
  )
  const updateProv = sqlite.prepare('UPDATE providers SET apiType = ?, apiBaseUrl = ? WHERE id = ?')
  const clearAcc = sqlite.prepare(
    `UPDATE provider_accounts SET apiType = '', apiBaseUrl = ''
     WHERE providerId = ?
       AND length(trim(COALESCE(apiBaseUrl, ''))) > 0
       AND (
         lower(trim(COALESCE(apiType, ''))) = 'billmanager'
         OR instr(lower(trim(COALESCE(apiBaseUrl, ''))), 'billmgr') > 0
       )`,
  )

  for (const prov of provRows) {
    if (String(prov.apiType || '').trim() || String(prov.apiBaseUrl || '').trim()) continue
    const accRows = accStmt.all(prov.id) as { apiBaseUrl: string | null }[]
    if (!accRows.length) continue
    const urls = [...new Set(accRows.map((r) => String(r.apiBaseUrl || '').trim()).filter(Boolean))]
    if (urls.length > 1) {
      console.warn(
        `[vps-tracker] У хостера ${prov.id} у нескольких аккаунтов разный URL BILLmanager — в настройках хостера взят первый.`,
      )
    }
    updateProv.run('billmanager', urls[0], prov.id)
    clearAcc.run(prov.id)
  }
}

export function heuristicBillmanagerProviderApi(sqlite: Database.Database): void {
  const provRows = sqlite.prepare('SELECT id, website, apiType, apiBaseUrl FROM providers').all() as {
    id: string
    website: string | null
    apiType: string | null
    apiBaseUrl: string | null
  }[]
  const accStmt = sqlite.prepare(
    `SELECT panelUrl FROM provider_accounts
     WHERE providerId = ? AND length(trim(COALESCE(panelUrl, ''))) > 0
     ORDER BY id`,
  )
  const updateProv = sqlite.prepare('UPDATE providers SET apiType = ?, apiBaseUrl = ? WHERE id = ?')

  for (const prov of provRows) {
    if (String(prov.apiType || '').trim() || String(prov.apiBaseUrl || '').trim()) continue
    let url = tryBillmgrUrl(prov.website)
    if (!url) {
      const accRows = accStmt.all(prov.id) as { panelUrl: string | null }[]
      for (const row of accRows) {
        url = tryBillmgrUrl(row.panelUrl)
        if (url) break
      }
    }
    if (url) updateProv.run('billmanager', url, prov.id)
  }
}

export function consolidateAllProviderApiSources(sqlite: Database.Database): void {
  consolidateProviderApiFromAccounts(sqlite)
  heuristicBillmanagerProviderApi(sqlite)
}
