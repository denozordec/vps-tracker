import { uid } from './utils'

const COLLECTIONS = {
  vps: 'vps',
  providers: 'providers',
  providerAccounts: 'providerAccounts',
  payments: 'payments',
  balanceLedger: 'balanceLedger',
  settings: 'settings',
}

const API_PATHS = {
  [COLLECTIONS.vps]: '/api/vps',
  [COLLECTIONS.providers]: '/api/providers',
  [COLLECTIONS.providerAccounts]: '/api/provider-accounts',
  [COLLECTIONS.payments]: '/api/payments',
  [COLLECTIONS.balanceLedger]: '/api/balance-ledger',
  [COLLECTIONS.settings]: '/api/settings',
}

const STORAGE_KEY_PREFIX = 'vps-tracker:'

const API_BASE = import.meta.env.VITE_API_URL || ''

function getLocalStorageData() {
  const data = {}
  for (const name of Object.values(COLLECTIONS)) {
    const key = `${STORAGE_KEY_PREFIX}${name}`
    const raw = localStorage.getItem(key)
    if (raw) {
      try {
        data[name] = JSON.parse(raw)
      } catch {
        data[name] = []
      }
    }
  }
  return data
}

function clearLocalStorage() {
  for (const name of Object.values(COLLECTIONS)) {
    localStorage.removeItem(`${STORAGE_KEY_PREFIX}${name}`)
  }
}

async function fetchApi(path, options = {}) {
  const url = `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  })
  if (!res.ok) {
    let message = res.statusText || 'API error'
    try {
      const data = await res.json()
      if (data?.error) message = data.error
    } catch {
      /* ignore */
    }
    const err = new Error(message)
    err.status = res.status
    err.response = res
    throw err
  }
  if (res.status === 204) return null
  return res.json()
}

export async function initDataStore() {
  const localData = getLocalStorageData()
  const hasLocalData = Object.keys(localData).some((k) => {
    const arr = localData[k]
    return Array.isArray(arr) ? arr.length > 0 : arr && typeof arr === 'object'
  })

  if (hasLocalData) {
    try {
      await fetchApi('/api/migrate', {
        method: 'POST',
        body: JSON.stringify(localData),
      })
      clearLocalStorage()
    } catch (err) {
      console.warn('Migration from localStorage failed:', err)
    }
  }
}

export async function loadDataSet() {
  const data = await fetchApi('/api/data')
  return {
    [COLLECTIONS.vps]: data.vps ?? [],
    [COLLECTIONS.providers]: data.providers ?? [],
    [COLLECTIONS.providerAccounts]: data.providerAccounts ?? [],
    [COLLECTIONS.payments]: data.payments ?? [],
    [COLLECTIONS.balanceLedger]: data.balanceLedger ?? [],
    [COLLECTIONS.settings]: data.settings ?? [],
    activeTariffs: data.activeTariffs ?? [],
    tariffSyncOptions: data.tariffSyncOptions ?? [],
    serverProjects: data.serverProjects ?? [],
  }
}

export async function fetchProjectSuggestions(q = '', limit = 25) {
  const params = new URLSearchParams()
  if (q) params.set('q', q)
  params.set('limit', String(limit))
  return fetchApi(`/api/projects/suggest?${params.toString()}`)
}

async function fetchCollection(collectionName) {
  const path = API_PATHS[collectionName]
  if (!path) throw new Error(`Unknown collection: ${collectionName}`)
  return fetchApi(path)
}

export async function createRecord(collectionName, record) {
  const path = API_PATHS[collectionName]
  if (!path) throw new Error(`Unknown collection: ${collectionName}`)
  const payload = { ...record, id: record.id || uid() }
  await fetchApi(path, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return fetchCollection(collectionName)
}

export async function updateRecord(collectionName, id, patch) {
  const path = API_PATHS[collectionName]
  if (!path) throw new Error(`Unknown collection: ${collectionName}`)
  await fetchApi(`${path}/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(patch),
  })
  return fetchCollection(collectionName)
}

export async function deleteRecord(collectionName, id) {
  const path = API_PATHS[collectionName]
  if (!path) throw new Error(`Unknown collection: ${collectionName}`)
  await fetchApi(`${path}/${encodeURIComponent(id)}`, { method: 'DELETE' })
  return fetchCollection(collectionName)
}

export async function bulkUpdateVps(ids, action, value) {
  return fetchApi('/api/vps/bulk', {
    method: 'PATCH',
    body: JSON.stringify({ ids, action, value }),
  })
}

export async function syncAccount(accountId, opts = {}) {
  return fetchApi(`/api/sync/${encodeURIComponent(accountId)}`, {
    method: 'POST',
    body: JSON.stringify(opts),
  })
}

export async function fetchAccountBalance(accountId) {
  return fetchApi(`/api/sync/${encodeURIComponent(accountId)}/balance`, { method: 'GET' })
}

export async function testApiConnection(apiBaseUrl, apiCredentials) {
  return fetchApi('/api/sync/test-connection', {
    method: 'POST',
    body: JSON.stringify({ apiBaseUrl, apiCredentials }),
  })
}

export async function fetchSyncStatus() {
  return fetchApi('/api/sync/status')
}

export async function sendTelegramTestNotification() {
  const res = await fetchApi('/api/settings/telegram/test', { method: 'POST' })
  return res
}

export async function downloadBackupJsonBlob() {
  const url = `${API_BASE}/api/backup/json`
  const res = await fetch(url)
  if (!res.ok) {
    let message = res.statusText || 'Ошибка выгрузки'
    try {
      const data = await res.json()
      if (data?.error) message = data.error
    } catch {
      /* ignore */
    }
    throw new Error(message)
  }
  return res.blob()
}

export async function downloadBackupDatabaseBlob() {
  const url = `${API_BASE}/api/backup/database`
  const res = await fetch(url)
  if (!res.ok) {
    let message = res.statusText || 'Ошибка выгрузки'
    try {
      const data = await res.json()
      if (data?.error) message = data.error
    } catch {
      /* ignore */
    }
    throw new Error(message)
  }
  return res.blob()
}

export async function importBackupJson(payload) {
  return fetchApi('/api/backup/json', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function importBackupDatabaseBuffer(buffer) {
  const url = `${API_BASE}/api/backup/database`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: buffer,
  })
  if (!res.ok) {
    let message = res.statusText || 'Ошибка восстановления'
    try {
      const data = await res.json()
      if (data?.error) message = data.error
    } catch {
      /* ignore */
    }
    const err = new Error(message)
    err.status = res.status
    throw err
  }
  return res.json()
}
