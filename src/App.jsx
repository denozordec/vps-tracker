import { useEffect, useMemo, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from './components/AppLayout'
import { DashboardPage } from './pages/DashboardPage'
import { VpsPage } from './pages/VpsPage'
import { ProvidersPage } from './pages/ProvidersPage'
import { AccountsPage } from './pages/AccountsPage'
import { PaymentsPage } from './pages/PaymentsPage'
import { BalancePage } from './pages/BalancePage'
import { ReportsPage } from './pages/ReportsPage'
import { ResourcesPage } from './pages/ResourcesPage'
import { SettingsPage } from './pages/SettingsPage'
import { TariffsPage } from './pages/TariffsPage'
import {
  createRecord,
  deleteRecord,
  initDataStore,
  loadDataSet,
  updateRecord,
} from './lib/api'
import { normalizeRatesPayload } from './lib/utils'

function App() {
  const [isReady, setIsReady] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [db, setDb] = useState({
    vps: [],
    providers: [],
    providerAccounts: [],
    payments: [],
    balanceLedger: [],
    settings: [],
    activeTariffs: [],
    tariffSyncOptions: [],
    serverProjects: [],
  })
  const [ratesData, setRatesData] = useState(null)
  const [ratesError, setRatesError] = useState('')

  useEffect(() => {
    initDataStore()
      .then(() => loadDataSet())
      .then((data) => {
        setDb(data)
        setIsReady(true)
        setLoadError('')
      })
      .catch((err) => {
        setLoadError(err.message || 'Ошибка загрузки данных')
        setIsReady(true)
      })
  }, [])

  useEffect(() => {
    const settings = db.settings?.[0]
    if (!settings?.ratesUrl) {
      return
    }
    const directUrl = settings.ratesUrl
    const proxyUrl = `/api/rates-proxy?url=${encodeURIComponent(directUrl)}`
    const handlePayload = (payload) => {
      setRatesData(normalizeRatesPayload(payload) ?? payload)
      setRatesError('')
    }
    const fetchJson = (url) =>
      fetch(url).then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
    fetchJson(proxyUrl)
      .then(handlePayload)
      .catch(() => fetchJson(directUrl).then(handlePayload))
      .catch((error) => {
        setRatesError(error.message || 'Ошибка загрузки курсов')
      })
  }, [db.settings])

  const actions = useMemo(
    () => ({
      create: async (collectionName, record) => {
        const nextCollection = await createRecord(collectionName, record)
        setDb((prev) => ({ ...prev, [collectionName]: nextCollection }))
      },
      update: async (collectionName, id, patch) => {
        const nextCollection = await updateRecord(collectionName, id, patch)
        setDb((prev) => ({ ...prev, [collectionName]: nextCollection }))
      },
      remove: async (collectionName, id) => {
        const nextCollection = await deleteRecord(collectionName, id)
        setDb((prev) => ({ ...prev, [collectionName]: nextCollection }))
      },
      upsertSettings: async (patch) => {
        const current = db.settings?.[0]
        if (current?.id) {
          const nextCollection = await updateRecord('settings', current.id, patch)
          setDb((prev) => ({ ...prev, settings: nextCollection }))
          return
        }
        const nextCollection = await createRecord('settings', {
          id: 'settings-main',
          baseCurrency: 'RUB',
          ratesUrl: 'https://www.cbr-xml-daily.ru/latest.js',
          autoConvert: true,
          ...patch,
        })
        setDb((prev) => ({ ...prev, settings: nextCollection }))
      },
      refreshData: async () => {
        const data = await loadDataSet()
        setDb(data)
      },
    }),
    [db.settings],
  )

  if (!isReady) {
    return (
      <div className="page page-center">
        <div className="container container-tight py-4 text-center">
          <div className="spinner-border text-blue" role="status" />
          <div className="text-secondary mt-2">Загрузка данных...</div>
        </div>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="page page-center">
        <div className="container container-tight py-4 text-center">
          <div className="text-danger mb-2">{loadError}</div>
          <div className="text-secondary">Убедитесь, что сервер запущен (npm run server)</div>
        </div>
      </div>
    )
  }

  return (
    <BrowserRouter>
      <AppLayout>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route
            path="/dashboard"
            element={<DashboardPage db={db} settings={db.settings} ratesData={ratesData} />}
          />
          <Route
            path="/vps"
            element={<VpsPage db={db} actions={actions} settings={db.settings} ratesData={ratesData} />}
          />
          <Route
            path="/tariffs"
            element={<TariffsPage db={db} actions={actions} settings={db.settings} ratesData={ratesData} />}
          />
          <Route
            path="/providers"
            element={<ProvidersPage db={db} actions={actions} />}
          />
          <Route
            path="/accounts"
            element={<AccountsPage db={db} actions={actions} settings={db.settings} ratesData={ratesData} />}
          />
          <Route
            path="/payments"
            element={<PaymentsPage db={db} actions={actions} settings={db.settings} ratesData={ratesData} />}
          />
          <Route
            path="/balance"
            element={<BalancePage db={db} actions={actions} settings={db.settings} ratesData={ratesData} />}
          />
          <Route
            path="/reports"
            element={<ReportsPage db={db} settings={db.settings} ratesData={ratesData} />}
          />
          <Route
            path="/resources"
            element={<ResourcesPage db={db} settings={db.settings} ratesData={ratesData} />}
          />
          <Route
            path="/settings"
            element={
              <SettingsPage
                db={db}
                actions={actions}
                ratesData={ratesData}
                ratesError={ratesError}
              />
            }
          />
        </Routes>
      </AppLayout>
    </BrowserRouter>
  )
}

export default App
