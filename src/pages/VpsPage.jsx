import { useMemo, useState } from 'react'
import {
  faviconUrlFromWebsite,
  getCountryFlagEmoji,
  normalizeWebsiteUrl,
  tariffTypeLabel,
  vpsStatusLabel,
} from '../lib/utils'
import {
  IconEdit,
  IconFilter,
  IconMapPin,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconServer,
  IconTrash,
} from '@tabler/icons-react'
import { syncAccount, bulkUpdateVps } from '../lib/api'
import { UiModal } from '../components/UiModal'
import { ConvertedAmount } from '../components/ConvertedAmount'
import { EmptyState } from '../components/EmptyState'
import { PageHeader } from '../components/PageHeader'

const emptyForm = {
  ip: '',
  ipv6: '',
  additionalIpsText: '',
  dns: '',
  providerId: '',
  providerAccountId: '',
  country: '',
  city: '',
  datacenter: '',
  os: '',
  vcpu: '',
  ramGb: '',
  diskGb: '',
  diskType: 'NVMe',
  virtualization: 'KVM',
  bandwidthTb: '',
  sshPort: '22',
  rootUser: 'root',
  purpose: '',
  environment: 'prod',
  project: '',
  monitoringEnabled: true,
  backupEnabled: false,
  status: 'active',
  tariffType: 'monthly',
  currency: 'USD',
  dailyRate: '',
  monthlyRate: '',
  createdAt: new Date().toISOString().slice(0, 10),
  paidUntil: '',
  notes: '',
  resetToApi: false,
}

export function VpsPage({ db, actions, settings, ratesData }) {
  const customFields = Array.isArray(settings?.[0]?.customFields) ? settings[0].customFields : []
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [viewMode, setViewMode] = useState('basic')
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)
  const [syncLoading, setSyncLoading] = useState(false)
  const [syncMessage, setSyncMessage] = useState(null)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [bulkLoading, setBulkLoading] = useState(false)

  const billmanagerAccounts = useMemo(
    () => db.providerAccounts.filter((a) => a.apiType === 'billmanager' && a.apiBaseUrl),
    [db.providerAccounts],
  )
  const [filters, setFilters] = useState({
    search: '',
    providerId: '',
    providerAccountId: '',
    country: '',
    city: '',
    datacenter: '',
    status: 'all',
    environment: 'all',
    tariffType: 'all',
    monitoring: 'all',
    backup: 'all',
    minVcpu: '',
    minRamGb: '',
    minDiskGb: '',
  })

  const filteredVps = useMemo(() => {
    return db.vps.filter((item) => {
      const search = filters.search.toLowerCase()
      const extraIps = Array.isArray(item.additionalIps) ? item.additionalIps.join(' ') : ''
      const minVcpu = Number(filters.minVcpu || 0)
      const minRamGb = Number(filters.minRamGb || 0)
      const minDiskGb = Number(filters.minDiskGb || 0)
      const bySearch =
        !search ||
        item.ip?.toLowerCase().includes(search) ||
        item.dns?.toLowerCase().includes(search) ||
        item.ipv6?.toLowerCase().includes(search) ||
        extraIps.toLowerCase().includes(search) ||
        item.project?.toLowerCase().includes(search) ||
        item.purpose?.toLowerCase().includes(search) ||
        item.os?.toLowerCase().includes(search)
      const byProvider = !filters.providerId || item.providerId === filters.providerId
      const byAccount =
        !filters.providerAccountId || item.providerAccountId === filters.providerAccountId
      const byCountry =
        !filters.country || item.country?.toLowerCase().includes(filters.country.toLowerCase())
      const byCity = !filters.city || item.city?.toLowerCase().includes(filters.city.toLowerCase())
      const byDatacenter =
        !filters.datacenter ||
        item.datacenter?.toLowerCase().includes(filters.datacenter.toLowerCase())
      const byStatus = filters.status === 'all' || item.status === filters.status
      const byEnvironment =
        filters.environment === 'all' || item.environment === filters.environment
      const byTariff = filters.tariffType === 'all' || item.tariffType === filters.tariffType
      const byMonitoring =
        filters.monitoring === 'all' ||
        (filters.monitoring === 'on' ? item.monitoringEnabled : !item.monitoringEnabled)
      const byBackup =
        filters.backup === 'all' ||
        (filters.backup === 'on' ? item.backupEnabled : !item.backupEnabled)
      const byCpu = !minVcpu || Number(item.vcpu || 0) >= minVcpu
      const byRam = !minRamGb || Number(item.ramGb || 0) >= minRamGb
      const byDisk = !minDiskGb || Number(item.diskGb || 0) >= minDiskGb
      const byCustomFields = customFields.every((f) => {
        const filterVal = (filters[f.key] || '').trim().toLowerCase()
        if (!filterVal) return true
        const itemVal = (item[f.key] || '').toLowerCase()
        return itemVal.includes(filterVal)
      })
      return (
        bySearch &&
        byProvider &&
        byAccount &&
        byCountry &&
        byCity &&
        byDatacenter &&
        byStatus &&
        byEnvironment &&
        byTariff &&
        byMonitoring &&
        byBackup &&
        byCustomFields &&
        byCpu &&
        byRam &&
        byDisk
      )
    })
  }, [db.vps, filters, customFields])

  const accountFilterOptions = useMemo(
    () =>
      db.providerAccounts.filter(
        (account) => !filters.providerId || account.providerId === filters.providerId,
      ),
    [db.providerAccounts, filters.providerId],
  )

  const activeFiltersCount = useMemo(() => {
    return Object.entries(filters).filter(([key, value]) => {
      if (key === 'search') {
        return Boolean(value)
      }
      if (['status', 'environment', 'tariffType', 'monitoring', 'backup'].includes(key)) {
        return value !== 'all'
      }
      if (customFields.some((f) => f.key === key)) {
        return Boolean(value)
      }
      return Boolean(value)
    }).length
  }, [filters, customFields])

  const accountOptions = db.providerAccounts.filter(
    (account) => !form.providerId || account.providerId === form.providerId,
  )

  const onSubmit = (event) => {
    event.preventDefault()
    if (!form.ip.trim() || !form.providerId || !form.providerAccountId) {
      return
    }
    const { additionalIpsText: _additionalIpsText, resetToApi, ...restForm } = form
    const additionalIps = form.additionalIpsText
      .split(/\r?\n|,/)
      .map((value) => value.trim())
      .filter(Boolean)
    const customFieldValues = {}
    customFields.forEach((f) => {
      customFieldValues[f.key] = form[f.key] ?? ''
    })
    const payload = {
      ...restForm,
      ...customFieldValues,
      additionalIps,
      dailyRate: form.tariffType === 'daily' ? form.dailyRate : '',
      monthlyRate: form.tariffType === 'monthly' ? form.monthlyRate : '',
    }
    if (resetToApi) {
      payload.userOverrides = 'clear'
    }
    if (editingId) {
      actions.update('vps', editingId, payload)
    } else {
      actions.create('vps', payload)
    }
    setEditingId(null)
    setForm(emptyForm)
    setIsModalOpen(false)
  }

  const onEdit = (vps) => {
    setForm({
      ip: vps.ip || '',
      ipv6: vps.ipv6 || '',
      additionalIpsText: Array.isArray(vps.additionalIps) ? vps.additionalIps.join('\n') : '',
      dns: vps.dns || '',
      providerId: vps.providerId || '',
      providerAccountId: vps.providerAccountId || '',
      country: vps.country || '',
      city: vps.city || '',
      datacenter: vps.datacenter || '',
      os: vps.os || '',
      vcpu: vps.vcpu || '',
      ramGb: vps.ramGb || '',
      diskGb: vps.diskGb || '',
      diskType: vps.diskType || 'NVMe',
      virtualization: vps.virtualization || 'KVM',
      bandwidthTb: vps.bandwidthTb || '',
      sshPort: vps.sshPort || '22',
      rootUser: vps.rootUser || 'root',
      purpose: vps.purpose || '',
      environment: vps.environment || 'prod',
      project: vps.project || '',
      monitoringEnabled: vps.monitoringEnabled !== false,
      backupEnabled: vps.backupEnabled === true,
      status: vps.status || 'active',
      tariffType:
        vps.tariffType || (Number(vps.dailyRate || 0) > 0 ? 'daily' : 'monthly'),
      currency: vps.currency || 'USD',
      dailyRate: vps.dailyRate || '',
      monthlyRate: vps.monthlyRate || '',
      createdAt: vps.createdAt || '',
      paidUntil: vps.paidUntil || '',
      notes: vps.notes || '',
      resetToApi: false,
      ...customFields.reduce((acc, f) => {
        acc[f.key] = vps[f.key] ?? ''
        return acc
      }, {}),
    })
    setEditingId(vps.id)
    setIsModalOpen(true)
  }

  const getAccountBalance = (providerAccountId) => {
    const rows = db.balanceLedger.filter((row) => row.providerAccountId === providerAccountId)
    const credits = rows
      .filter((row) => row.direction === 'credit')
      .reduce((acc, row) => acc + Number(row.amount || 0), 0)
    const debits = rows
      .filter((row) => row.direction === 'debit')
      .reduce((acc, row) => acc + Number(row.amount || 0), 0)
    return credits - debits
  }

  const getPaidUntilDate = (item) => {
    if (item.status !== 'active') {
      return '-'
    }
    if (item.paidUntil) {
      try {
        const d = new Date(item.paidUntil)
        return Number.isNaN(d.getTime()) ? '-' : d.toLocaleDateString('ru-RU')
      } catch {
        return item.paidUntil
      }
    }
    const tariffType = item.tariffType || (Number(item.dailyRate || 0) > 0 ? 'daily' : 'monthly')
    const dailyRate = Number(item.dailyRate || 0)
    const monthlyRate = Number(item.monthlyRate || 0)
    const activeRate = tariffType === 'daily' ? dailyRate : monthlyRate
    if (activeRate <= 0) {
      return '-'
    }
    const burnRate = tariffType === 'daily' ? dailyRate : monthlyRate / 30
    if (!Number.isFinite(burnRate) || burnRate <= 0) {
      return '-'
    }

    const directPayments = db.payments
      .filter((payment) => payment.vpsId === item.id && payment.type === 'direct_vps_payment')
      .reduce((acc, payment) => acc + Number(payment.amount || 0), 0)

    const accountBalance = getAccountBalance(item.providerAccountId)
    const activeInAccount = db.vps.filter(
      (vps) => vps.providerAccountId === item.providerAccountId && vps.status === 'active',
    ).length
    const allocatedBalance = activeInAccount > 0 ? Math.max(0, accountBalance) / activeInAccount : 0

    const funds = directPayments + allocatedBalance
    const coveredDays = Math.floor(funds / burnRate)
    if (!Number.isFinite(coveredDays) || coveredDays <= 0) {
      return '-'
    }

    const paidUntil = new Date()
    paidUntil.setDate(paidUntil.getDate() + coveredDays)
    return paidUntil.toLocaleDateString('ru-RU')
  }

  const activeTariffAmount = (item) =>
    (item.tariffType || (Number(item.dailyRate || 0) > 0 ? 'daily' : 'monthly')) === 'daily'
      ? Number(item.dailyRate || 0)
      : Number(item.monthlyRate || 0)

  const nearlyEqual = (a, b, epsilon = 0.0001) => Math.abs(Number(a || 0) - Number(b || 0)) < epsilon

  const onSync = async () => {
    if (billmanagerAccounts.length === 0) return
    setSyncLoading(true)
    setSyncMessage(null)
    let totalVps = 0
    let totalPayments = 0
    let lastError = null
    for (const account of billmanagerAccounts) {
      try {
        const result = await syncAccount(account.id)
        if (result.ok) {
          totalVps += result.synced?.vpsCount ?? 0
          totalPayments += result.synced?.paymentsCount ?? 0
        } else {
          lastError = result.error
        }
      } catch (err) {
        lastError = err.message
      }
    }
    if (lastError && totalVps === 0 && totalPayments === 0) {
      setSyncMessage(lastError)
    } else {
      const parts = []
      if (totalVps > 0) parts.push(`${totalVps} VPS`)
      if (totalPayments > 0) parts.push(`${totalPayments} платежей`)
      setSyncMessage(`Синхронизировано: ${parts.join(', ')}${lastError ? `. Ошибки: ${lastError}` : ''}`)
    }
    if (totalVps > 0 || totalPayments > 0) await actions.refreshData()
    setSyncLoading(false)
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredVps.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredVps.map((v) => v.id)))
    }
  }

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const onBulkStatus = async (status) => {
    const ids = [...selectedIds]
    if (ids.length === 0) return
    setBulkLoading(true)
    try {
      await bulkUpdateVps(ids, 'status', status)
      setSelectedIds(new Set())
      await actions.refreshData()
    } catch (err) {
      setSyncMessage(err.message || 'Ошибка массового обновления')
    } finally {
      setBulkLoading(false)
    }
  }

  const onBulkDelete = async () => {
    const ids = [...selectedIds]
    if (ids.length === 0) return
    if (!window.confirm(`Удалить ${ids.length} VPS?`)) return
    setBulkLoading(true)
    try {
      await bulkUpdateVps(ids, 'delete')
      setSelectedIds(new Set())
      await actions.refreshData()
    } catch (err) {
      setSyncMessage(err.message || 'Ошибка массового удаления')
    } finally {
      setBulkLoading(false)
    }
  }

  const resetFilters = () => {
    setFilters({
      search: '',
      providerId: '',
      providerAccountId: '',
      country: '',
      city: '',
      datacenter: '',
      status: 'all',
      environment: 'all',
      tariffType: 'all',
      monitoring: 'all',
      backup: 'all',
      minVcpu: '',
      minRamGb: '',
      minDiskGb: '',
      ...customFields.reduce((acc, f) => {
        acc[f.key] = ''
        return acc
      }, {}),
    })
  }

  return (
    <>
      <PageHeader pretitle="Управление инфраструктурой" title="VPS серверы" />
      <div className="row row-cards">
      <div className="col-12 card-stack">
        <div className="card">
          <div className="card-body">
            <div className="d-flex align-items-center justify-content-between mb-2">
              <div className="text-secondary small">Активных фильтров: {activeFiltersCount}</div>
              <div className="d-flex gap-2">
                <button
                  type="button"
                  className="btn btn-sm btn-outline-primary"
                  onClick={() => setShowAdvancedFilters((prev) => !prev)}
                >
                  {showAdvancedFilters ? 'Скрыть фильтры' : 'Показать фильтры'}
                </button>
                <button type="button" className="btn btn-sm btn-outline-secondary" onClick={resetFilters}>
                  Сбросить
                </button>
              </div>
            </div>
            <div className="row g-2">
              <div className="col-xl-3 col-lg-4 col-md-6">
                <div className="input-icon">
                  <span className="input-icon-addon">
                    <IconSearch size={16} />
                  </span>
                  <input
                    className="form-control"
                    placeholder="Поиск IP / DNS"
                    value={filters.search}
                    onChange={(e) =>
                      setFilters((prev) => ({
                        ...prev,
                        search: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>
              {showAdvancedFilters ? (
                <>
              <div className="col-xl-2 col-lg-4 col-md-6">
                <select
                  className="form-select"
                  value={filters.providerId}
                  onChange={(e) =>
                    setFilters((prev) => ({
                      ...prev,
                      providerId: e.target.value,
                      providerAccountId: '',
                    }))
                  }
                >
                  <option value="">Все хостеры</option>
                  {db.providers.map((provider) => (
                    <option key={provider.id} value={provider.id}>
                      {provider.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-xl-2 col-lg-4 col-md-6">
                <select
                  className="form-select"
                  value={filters.providerAccountId}
                  onChange={(e) =>
                    setFilters((prev) => ({
                      ...prev,
                      providerAccountId: e.target.value,
                    }))
                  }
                >
                  <option value="">Все аккаунты</option>
                  {accountFilterOptions.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-xl-2 col-lg-4 col-md-6">
                <select
                  className="form-select"
                  value={filters.status}
                  onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}
                >
                  <option value="all">Любой статус</option>
                  <option value="active">Активен</option>
                  <option value="paused">Приостановлен</option>
                  <option value="archived">Архив</option>
                </select>
              </div>
              <div className="col-xl-3 col-lg-4 col-md-6">
                <select
                  className="form-select"
                  value={filters.environment}
                  onChange={(e) => setFilters((prev) => ({ ...prev, environment: e.target.value }))}
                >
                  <option value="all">Любое окружение</option>
                  <option value="prod">prod</option>
                  <option value="stage">stage</option>
                  <option value="dev">dev</option>
                  <option value="test">test</option>
                </select>
              </div>
              <div className="col-xl-2 col-lg-4 col-md-6">
                <select
                  className="form-select"
                  value={filters.tariffType}
                  onChange={(e) => setFilters((prev) => ({ ...prev, tariffType: e.target.value }))}
                >
                  <option value="all">Любой тариф</option>
                  <option value="daily">Суточный</option>
                  <option value="monthly">Месячный</option>
                </select>
              </div>
              <div className="col-xl-2 col-lg-4 col-md-6">
                <select
                  className="form-select"
                  value={filters.monitoring}
                  onChange={(e) => setFilters((prev) => ({ ...prev, monitoring: e.target.value }))}
                >
                  <option value="all">Мониторинг: любой</option>
                  <option value="on">Мониторинг: вкл</option>
                  <option value="off">Мониторинг: выкл</option>
                </select>
              </div>
              <div className="col-xl-2 col-lg-4 col-md-6">
                <select
                  className="form-select"
                  value={filters.backup}
                  onChange={(e) => setFilters((prev) => ({ ...prev, backup: e.target.value }))}
                >
                  <option value="all">Бэкап: любой</option>
                  <option value="on">Бэкап: вкл</option>
                  <option value="off">Бэкап: выкл</option>
                </select>
              </div>
              <div className="col-xl-2 col-lg-4 col-md-6">
                <div className="input-icon">
                  <span className="input-icon-addon">
                    <IconFilter size={16} />
                  </span>
                  <input
                    className="form-control"
                    placeholder="Страна"
                    value={filters.country}
                    onChange={(e) =>
                      setFilters((prev) => ({
                        ...prev,
                        country: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>
              <div className="col-xl-2 col-lg-4 col-md-6">
                <div className="input-icon">
                  <span className="input-icon-addon">
                    <IconMapPin size={16} />
                  </span>
                  <input
                    className="form-control"
                    placeholder="Город"
                    value={filters.city}
                    onChange={(e) =>
                      setFilters((prev) => ({
                        ...prev,
                        city: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>
              <div className="col-xl-2 col-lg-4 col-md-6">
                <input
                  className="form-control"
                  placeholder="ДЦ"
                  value={filters.datacenter}
                  onChange={(e) => setFilters((prev) => ({ ...prev, datacenter: e.target.value }))}
                />
              </div>
              <div className="col-xl-2 col-lg-4 col-md-6">
                <input
                  type="number"
                  min="0"
                  className="form-control"
                  placeholder="vCPU от"
                  value={filters.minVcpu}
                  onChange={(e) => setFilters((prev) => ({ ...prev, minVcpu: e.target.value }))}
                />
              </div>
              <div className="col-xl-2 col-lg-4 col-md-6">
                <input
                  type="number"
                  min="0"
                  className="form-control"
                  placeholder="RAM от, GB"
                  value={filters.minRamGb}
                  onChange={(e) => setFilters((prev) => ({ ...prev, minRamGb: e.target.value }))}
                />
              </div>
              <div className="col-xl-2 col-lg-4 col-md-6">
                <input
                  type="number"
                  min="0"
                  className="form-control"
                  placeholder="Диск от, GB"
                  value={filters.minDiskGb}
                  onChange={(e) => setFilters((prev) => ({ ...prev, minDiskGb: e.target.value }))}
                />
              </div>
              {customFields.map((f) => (
                <div key={f.key} className="col-xl-2 col-lg-4 col-md-6">
                  <input
                    className="form-control"
                    placeholder={f.label}
                    value={filters[f.key] ?? ''}
                    onChange={(e) => setFilters((prev) => ({ ...prev, [f.key]: e.target.value }))}
                  />
                </div>
              ))}
                </>
              ) : null}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title">VPS список</h3>
            {selectedIds.size > 0 ? (
              <div className="d-flex align-items-center gap-2 me-2">
                <span className="text-secondary small">Выбрано: {selectedIds.size}</span>
                <div className="btn-group btn-group-sm">
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={() => onBulkStatus('archived')}
                    disabled={bulkLoading}
                  >
                    В архив
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={() => onBulkStatus('active')}
                    disabled={bulkLoading}
                  >
                    Активен
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={() => onBulkStatus('paused')}
                    disabled={bulkLoading}
                  >
                    Приостановлен
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline-danger"
                    onClick={onBulkDelete}
                    disabled={bulkLoading}
                  >
                    Удалить
                  </button>
                </div>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  onClick={() => setSelectedIds(new Set())}
                >
                  Снять выбор
                </button>
              </div>
            ) : null}
            {syncMessage ? (
              <div className={`alert alert-${syncMessage.startsWith('Синхронизировано') ? 'success' : 'warning'} py-2 mb-0 me-2`}>
                {syncMessage}
              </div>
            ) : null}
            <div className="card-actions">
              <div className="vps-header-actions">
                <div className="btn-group" role="group" aria-label="Режим таблицы VPS">
                  <button
                    type="button"
                    className={`btn btn-sm ${viewMode === 'basic' ? 'btn-primary' : 'btn-outline-primary'}`}
                    onClick={() => setViewMode('basic')}
                  >
                    Базовый
                  </button>
                  <button
                    type="button"
                    className={`btn btn-sm ${viewMode === 'extended' ? 'btn-primary' : 'btn-outline-primary'}`}
                    onClick={() => setViewMode('extended')}
                  >
                    Расширенный
                  </button>
                </div>
                {billmanagerAccounts.length > 0 ? (
                  <button
                    type="button"
                    className="btn btn-outline-primary btn-sm"
                    onClick={onSync}
                    disabled={syncLoading}
                    title="Синхронизировать VPS и платежи из BILLmanager"
                  >
                    {syncLoading ? (
                      <span className="spinner-border spinner-border-sm me-1" role="status" />
                    ) : (
                      <IconRefresh size={16} className="me-1" />
                    )}
                    Синхронизировать
                  </button>
                ) : null}
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => {
                    const base = { ...emptyForm }
                    customFields.forEach((f) => {
                      base[f.key] = ''
                    })
                    setForm(base)
                    setEditingId(null)
                    setIsModalOpen(true)
                  }}
                >
                  <IconPlus size={16} className="me-1" />
                  Добавить VPS
                </button>
              </div>
            </div>
          </div>
          <div className="table-responsive">
            <table className="table card-table table-vcenter">
              <thead>
                <tr>
                  <th style={{ width: 40 }}>
                    <input
                      type="checkbox"
                      className="form-check-input"
                      checked={filteredVps.length > 0 && selectedIds.size === filteredVps.length}
                      onChange={toggleSelectAll}
                      title="Выбрать все на странице"
                    />
                  </th>
                  <th>IP / DNS</th>
                  <th>Хостер / Аккаунт</th>
                  <th>Локация</th>
                  {viewMode === 'extended' ? (
                    <>
                      <th>IPv6</th>
                      <th>ДЦ</th>
                      <th>ОС</th>
                      <th>vCPU</th>
                      <th>RAM, GB</th>
                      <th>Диск, GB</th>
                      <th>Тип диска</th>
                      <th>Виртуализация</th>
                      <th>BW, TB</th>
                      <th>SSH user</th>
                      <th>SSH порт</th>
                      <th>Окружение</th>
                      <th>Проект</th>
                      <th>Назначение</th>
                      <th>Мониторинг</th>
                      <th>Бэкап</th>
                      {customFields.map((f) => (
                        <th key={f.key}>{f.label}</th>
                      ))}
                    </>
                  ) : null}
                  <th>Оплачено до</th>
                  <th>Панель</th>
                  <th>Платежи</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filteredVps.map((item) => {
                  const provider = db.providers.find((providerRow) => providerRow.id === item.providerId)
                  const account = db.providerAccounts.find(
                    (accountRow) => accountRow.id === item.providerAccountId,
                  )
                  const relatedPaymentSum = db.payments
                    .filter((payment) => payment.vpsId === item.id)
                    .reduce((acc, payment) => acc + Number(payment.amount || 0), 0)
                  const tariffAmount = activeTariffAmount(item)
                  const showPaidBlock =
                    Number(relatedPaymentSum) > 0 &&
                    !nearlyEqual(relatedPaymentSum, tariffAmount)
                  return (
                    <tr key={item.id}>
                      <td>
                        <input
                          type="checkbox"
                          className="form-check-input"
                          checked={selectedIds.has(item.id)}
                          onChange={() => toggleSelect(item.id)}
                        />
                      </td>
                      <td>
                        <div className="fw-medium">{item.ip}</div>
                        {Array.isArray(item.additionalIps)
                          ? item.additionalIps.map((extraIp, idx) => (
                              <div key={`${item.id}-ip-${idx}`} className="text-secondary">
                                {extraIp}
                              </div>
                            ))
                          : null}
                        <div className="text-secondary">{item.dns || '-'}</div>
                      </td>
                      <td>
                        <div className="d-flex align-items-center gap-2">
                          {faviconUrlFromWebsite(provider?.website) ? (
                            <img
                              src={faviconUrlFromWebsite(provider?.website)}
                              alt=""
                              width="16"
                              height="16"
                              className="rounded"
                            />
                          ) : null}
                          <span>{provider?.name || '-'}</span>
                        </div>
                        <div className="text-secondary">{account?.name || '-'}</div>
                      </td>
                      <td>
                        <span title={item.country || 'Неизвестная страна'}>
                          {getCountryFlagEmoji(item.country)}
                        </span>{' '}
                        {item.city || '-'}
                        <div>
                          <span
                            className={`badge ${
                              item.status === 'active'
                                ? 'bg-green-lt'
                                : item.status === 'paused'
                                  ? 'bg-yellow-lt'
                                  : 'bg-secondary-lt'
                            }`}
                          >
                            {vpsStatusLabel(item.status)}
                          </span>
                        </div>
                      </td>
                      {viewMode === 'extended' ? (
                        <>
                          <td>{item.ipv6 || '-'}</td>
                          <td>{item.datacenter || '-'}</td>
                          <td>{item.os || '-'}</td>
                          <td>{item.vcpu || '-'}</td>
                          <td>{item.ramGb || '-'}</td>
                          <td>{item.diskGb || '-'}</td>
                          <td>{item.diskType || '-'}</td>
                          <td>{item.virtualization || '-'}</td>
                          <td>{item.bandwidthTb || '-'}</td>
                          <td>{item.rootUser || '-'}</td>
                          <td>{item.sshPort || '-'}</td>
                          <td>{item.environment || '-'}</td>
                          <td>{item.project || '-'}</td>
                          <td>{item.purpose || '-'}</td>
                          <td>
                            <span
                              className={`badge ${
                                item.monitoringEnabled
                                  ? 'bg-green-lt text-green'
                                  : 'bg-secondary-lt text-secondary'
                              }`}
                            >
                              {item.monitoringEnabled ? 'Вкл' : 'Выкл'}
                            </span>
                          </td>
                          <td>
                            <span
                              className={`badge ${
                                item.backupEnabled
                                  ? 'bg-blue-lt text-blue'
                                  : 'bg-secondary-lt text-secondary'
                              }`}
                            >
                              {item.backupEnabled ? 'Вкл' : 'Выкл'}
                            </span>
                          </td>
                          {customFields.map((f) => (
                            <td key={f.key}>{item[f.key] || '-'}</td>
                          ))}
                        </>
                      ) : null}
                      <td>{getPaidUntilDate(item)}</td>
                      <td>
                        {normalizeWebsiteUrl(account?.panelUrl || provider?.website) ? (
                          <a
                            href={normalizeWebsiteUrl(account?.panelUrl || provider?.website)}
                            target="_blank"
                            rel="noreferrer"
                            className="btn btn-sm btn-outline-secondary"
                          >
                            Открыть
                          </a>
                        ) : (
                          <span className="text-secondary">—</span>
                        )}
                      </td>
                      <td>
                        {showPaidBlock ? (
                          <>
                            <div className="text-secondary small">Оплачено:</div>
                            <ConvertedAmount
                              amount={relatedPaymentSum}
                              currency={item.currency}
                              provider={provider}
                              settings={settings}
                              ratesData={ratesData}
                            />
                          </>
                        ) : null}
                        <div className="text-secondary small mt-1">
                          {tariffTypeLabel(
                            item.tariffType || (Number(item.dailyRate || 0) > 0 ? 'daily' : 'monthly'),
                          )}
                          :
                        </div>
                        <ConvertedAmount
                          amount={tariffAmount}
                          currency={item.currency}
                          provider={provider}
                          settings={settings}
                          ratesData={ratesData}
                        />
                      </td>
                      <td className="text-end">
                        <div className="table-actions">
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-primary"
                            onClick={() => onEdit(item)}
                          >
                            <IconEdit size={14} className="me-1" />
                            Изменить
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger"
                            onClick={() => actions.remove('vps', item.id)}
                          >
                            <IconTrash size={14} className="me-1" />
                            Удалить
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {filteredVps.length === 0 ? (
                  <EmptyState
                    message="По фильтрам ничего не найдено"
                    colSpan={viewMode === 'extended' ? 25 + customFields.length : 9}
                  />
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

      <UiModal
        open={isModalOpen}
        title={editingId ? 'Редактировать VPS' : 'Новый VPS'}
        onClose={() => {
          setIsModalOpen(false)
          setEditingId(null)
          setForm(emptyForm)
        }}
        size="modal-xl"
        scrollable
        footer={
          <div className="d-flex gap-2 justify-content-end w-100">
            <button type="button" className="btn btn-outline-secondary" onClick={() => setIsModalOpen(false)}>
              Отмена
            </button>
            <button type="submit" form="vps-form" className="btn btn-primary">
              <IconPlus size={16} className="me-1" />
              {editingId ? 'Сохранить' : 'Добавить'}
            </button>
          </div>
        }
      >
        <form id="vps-form" onSubmit={onSubmit} className="vps-modal-form">
          <section className="vps-form-section">
            <h6 className="vps-form-section-title">Сеть</h6>
            <div className="row g-3">
              <div className="col-12 col-sm-6">
                <label className="form-label">IP</label>
                <input
                  className="form-control"
                  value={form.ip}
                  onChange={(e) => setForm((prev) => ({ ...prev, ip: e.target.value }))}
                  placeholder="192.168.1.1"
                  required
                />
              </div>
              <div className="col-12 col-sm-6">
                <label className="form-label">DNS</label>
                <input
                  className="form-control"
                  value={form.dns}
                  onChange={(e) => setForm((prev) => ({ ...prev, dns: e.target.value }))}
                  placeholder="server.example.com"
                />
              </div>
              <div className="col-12 col-sm-6">
                <label className="form-label">IPv6</label>
                <input
                  className="form-control"
                  value={form.ipv6}
                  onChange={(e) => setForm((prev) => ({ ...prev, ipv6: e.target.value }))}
                  placeholder="2a01:4f8::1"
                />
              </div>
              <div className="col-12 col-sm-6">
                <label className="form-label">Дополнительные IP</label>
                <textarea
                  className="form-control"
                  rows={2}
                  value={form.additionalIpsText}
                  onChange={(e) => setForm((prev) => ({ ...prev, additionalIpsText: e.target.value }))}
                  placeholder="По одному адресу в строке"
                />
              </div>
            </div>
          </section>

          <section className="vps-form-section">
            <h6 className="vps-form-section-title">Провайдер и локация</h6>
            <div className="row g-3">
              <div className="col-12 col-sm-6">
                <label className="form-label">Хостер</label>
                <select
                  className="form-select"
                  value={form.providerId}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      providerId: e.target.value,
                      providerAccountId: '',
                    }))
                  }
                  required
                >
                  <option value="">— Выберите —</option>
                  {db.providers.map((provider) => (
                    <option key={provider.id} value={provider.id}>
                      {provider.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-12 col-sm-6">
                <label className="form-label">Аккаунт хостера</label>
                <select
                  className="form-select"
                  value={form.providerAccountId}
                  onChange={(e) => setForm((prev) => ({ ...prev, providerAccountId: e.target.value }))}
                  required
                >
                  <option value="">— Выберите —</option>
                  {accountOptions.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-12 col-sm-6">
                <label className="form-label">Страна</label>
                <input
                  className="form-control"
                  value={form.country}
                  onChange={(e) => setForm((prev) => ({ ...prev, country: e.target.value }))}
                  placeholder="Germany"
                />
              </div>
              <div className="col-12 col-sm-6">
                <label className="form-label">Город</label>
                <input
                  className="form-control"
                  value={form.city}
                  onChange={(e) => setForm((prev) => ({ ...prev, city: e.target.value }))}
                  placeholder="Frankfurt"
                />
              </div>
              <div className="col-12 col-sm-6">
                <label className="form-label">ДЦ / зона</label>
                <input
                  className="form-control"
                  value={form.datacenter}
                  onChange={(e) => setForm((prev) => ({ ...prev, datacenter: e.target.value }))}
                  placeholder="fra1"
                />
              </div>
              <div className="col-12 col-sm-6">
                <label className="form-label">ОС</label>
                <input
                  className="form-control"
                  value={form.os}
                  onChange={(e) => setForm((prev) => ({ ...prev, os: e.target.value }))}
                  placeholder="Ubuntu 24.04 LTS"
                />
              </div>
            </div>
          </section>

          <section className="vps-form-section">
            <h6 className="vps-form-section-title">Ресурсы</h6>
            <div className="row g-3">
              <div className="col-12 col-sm-6 col-md-4">
                <label className="form-label">vCPU</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  className="form-control"
                  value={form.vcpu}
                  onChange={(e) => setForm((prev) => ({ ...prev, vcpu: e.target.value }))}
                  placeholder="2"
                />
              </div>
              <div className="col-12 col-sm-6 col-md-4">
                <label className="form-label">RAM (GB)</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  className="form-control"
                  value={form.ramGb}
                  onChange={(e) => setForm((prev) => ({ ...prev, ramGb: e.target.value }))}
                  placeholder="4"
                />
              </div>
              <div className="col-12 col-sm-6 col-md-4">
                <label className="form-label">Диск (GB)</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  className="form-control"
                  value={form.diskGb}
                  onChange={(e) => setForm((prev) => ({ ...prev, diskGb: e.target.value }))}
                  placeholder="80"
                />
              </div>
              <div className="col-12 col-sm-6 col-md-4">
                <label className="form-label">Тип диска</label>
                <select
                  className="form-select"
                  value={form.diskType}
                  onChange={(e) => setForm((prev) => ({ ...prev, diskType: e.target.value }))}
                >
                  <option value="NVMe">NVMe</option>
                  <option value="SSD">SSD</option>
                  <option value="HDD">HDD</option>
                </select>
              </div>
              <div className="col-12 col-sm-6 col-md-4">
                <label className="form-label">Виртуализация</label>
                <select
                  className="form-select"
                  value={form.virtualization}
                  onChange={(e) => setForm((prev) => ({ ...prev, virtualization: e.target.value }))}
                >
                  <option value="KVM">KVM</option>
                  <option value="Xen">Xen</option>
                  <option value="VMware">VMware</option>
                  <option value="Hyper-V">Hyper-V</option>
                  <option value="LXC">LXC</option>
                </select>
              </div>
              <div className="col-12 col-sm-6 col-md-4">
                <label className="form-label">Трафик (TB)</label>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  className="form-control"
                  value={form.bandwidthTb}
                  onChange={(e) => setForm((prev) => ({ ...prev, bandwidthTb: e.target.value }))}
                  placeholder="5"
                />
              </div>
            </div>
          </section>

          <section className="vps-form-section">
            <h6 className="vps-form-section-title">SSH и назначение</h6>
            <div className="row g-3">
              <div className="col-12 col-sm-6">
                <label className="form-label">Пользователь SSH</label>
                <input
                  className="form-control"
                  value={form.rootUser}
                  onChange={(e) => setForm((prev) => ({ ...prev, rootUser: e.target.value }))}
                />
              </div>
              <div className="col-12 col-sm-6">
                <label className="form-label">SSH порт</label>
                <input
                  type="number"
                  min="1"
                  max="65535"
                  className="form-control"
                  value={form.sshPort}
                  onChange={(e) => setForm((prev) => ({ ...prev, sshPort: e.target.value }))}
                />
              </div>
              <div className="col-12 col-sm-6">
                <label className="form-label">Окружение</label>
                <select
                  className="form-select"
                  value={form.environment}
                  onChange={(e) => setForm((prev) => ({ ...prev, environment: e.target.value }))}
                >
                  <option value="prod">prod</option>
                  <option value="stage">stage</option>
                  <option value="dev">dev</option>
                  <option value="test">test</option>
                </select>
              </div>
              <div className="col-12 col-sm-6">
                <label className="form-label">Проект</label>
                <input
                  className="form-control"
                  value={form.project}
                  onChange={(e) => setForm((prev) => ({ ...prev, project: e.target.value }))}
                  placeholder="my-project"
                />
              </div>
              <div className="col-12 col-sm-6">
                <label className="form-label">Назначение</label>
                <input
                  className="form-control"
                  value={form.purpose}
                  onChange={(e) => setForm((prev) => ({ ...prev, purpose: e.target.value }))}
                  placeholder="api, db, worker..."
                />
              </div>
              <div className="col-12 col-sm-6 d-flex align-items-end gap-3 pt-2">
                <label className="form-check mb-0">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    checked={form.monitoringEnabled}
                    onChange={(e) => setForm((prev) => ({ ...prev, monitoringEnabled: e.target.checked }))}
                  />
                  <span className="form-check-label">Мониторинг</span>
                </label>
                <label className="form-check mb-0">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    checked={form.backupEnabled}
                    onChange={(e) => setForm((prev) => ({ ...prev, backupEnabled: e.target.checked }))}
                  />
                  <span className="form-check-label">Бэкапы</span>
                </label>
              </div>
            </div>
          </section>

          <section className="vps-form-section">
            <h6 className="vps-form-section-title">Тариф и оплата</h6>
            <div className="row g-3">
              <div className="col-12 col-sm-6 col-md-4">
                <label className="form-label">Статус</label>
                <select
                  className="form-select"
                  value={form.status}
                  onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}
                >
                  <option value="active">{vpsStatusLabel('active')}</option>
                  <option value="paused">{vpsStatusLabel('paused')}</option>
                  <option value="archived">{vpsStatusLabel('archived')}</option>
                </select>
              </div>
              <div className="col-12 col-sm-6 col-md-4">
                <label className="form-label">Тип тарифа</label>
                <select
                  className="form-select"
                  value={form.tariffType}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      tariffType: e.target.value,
                      dailyRate: e.target.value === 'daily' ? prev.dailyRate : '',
                      monthlyRate: e.target.value === 'monthly' ? prev.monthlyRate : '',
                    }))
                  }
                >
                  <option value="daily">{tariffTypeLabel('daily')}</option>
                  <option value="monthly">{tariffTypeLabel('monthly')}</option>
                </select>
              </div>
              <div className="col-12 col-sm-6 col-md-4">
                <label className="form-label">
                  {form.tariffType === 'daily' ? 'Суточный тариф' : 'Месячный тариф'}
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="form-control"
                  value={form.tariffType === 'daily' ? form.dailyRate : form.monthlyRate}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      dailyRate: prev.tariffType === 'daily' ? e.target.value : '',
                      monthlyRate: prev.tariffType === 'monthly' ? e.target.value : '',
                    }))
                  }
                  placeholder="0.00"
                />
              </div>
              <div className="col-12 col-sm-6">
                <label className="form-label">Дата создания</label>
                <input
                  type="date"
                  className="form-control"
                  value={form.createdAt}
                  onChange={(e) => setForm((prev) => ({ ...prev, createdAt: e.target.value }))}
                />
              </div>
              <div className="col-12 col-sm-6">
                <label className="form-label">Оплачено до</label>
                <input
                  type="date"
                  className="form-control"
                  value={form.paidUntil}
                  onChange={(e) => setForm((prev) => ({ ...prev, paidUntil: e.target.value }))}
                  placeholder="Дата окончания оплаченного периода"
                />
              </div>
            </div>
          </section>

          <section className="vps-form-section">
            <h6 className="vps-form-section-title">Заметки</h6>
            <div className="row g-3">
              <div className="col-12">
                <textarea
                  className="form-control"
                  rows={3}
                  value={form.notes}
                  onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                  placeholder="Дополнительная информация..."
                />
              </div>
              {editingId && (form.notes?.includes('bm-') || (db.vps.find((v) => v.id === editingId)?.userOverrides?.length ?? 0) > 0) ? (
                <div className="col-12">
                  <label className="form-check">
                    <input
                      type="checkbox"
                      className="form-check-input"
                      checked={form.resetToApi}
                      onChange={(e) => setForm((prev) => ({ ...prev, resetToApi: e.target.checked }))}
                    />
                    <span className="form-check-label">Сбросить к данным API (при следующей синхронизации поля будут перезаписаны)</span>
                  </label>
                </div>
              ) : null}
            </div>
          </section>

          {customFields.length > 0 ? (
            <section className="vps-form-section">
              <h6 className="vps-form-section-title">Дополнительные поля</h6>
              <div className="row g-3">
                {customFields.map((f) => (
                  <div key={f.key} className="col-12 col-sm-6">
                    <label className="form-label">{f.label}</label>
                    <input
                      type="text"
                      className="form-control"
                      value={form[f.key] ?? ''}
                      onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
                    />
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </form>
      </UiModal>
    </>
  )
}
