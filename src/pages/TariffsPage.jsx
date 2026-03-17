import { useMemo, useState } from 'react'
import { convertCurrency, formatCurrency, faviconUrlFromWebsite, normalizeWebsiteUrl } from '../lib/utils'
import {
  IconArrowDown,
  IconArrowUp,
  IconMapPin,
  IconRefresh,
  IconSearch,
  IconServer,
} from '@tabler/icons-react'
import { syncAccount } from '../lib/api'
import { EmptyState } from '../components/EmptyState'
import { PageHeader } from '../components/PageHeader'

const SORT_COLUMNS = ['name', 'vcpu', 'ramGb', 'diskGb', 'diskType', 'virtualization', 'channel', 'country', 'location', 'price']

function SortHeader({ column, children, onSort, sortBy, sortDir }) {
  return (
    <th
      role="button"
      tabIndex={0}
      onClick={() => onSort(column)}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSort(column)}
      style={SORT_COLUMNS.includes(column) ? { cursor: 'pointer', userSelect: 'none' } : undefined}
    >
      {children}
      {sortBy === column && (sortDir === 'asc' ? <IconArrowUp size={14} className="ms-1" /> : <IconArrowDown size={14} className="ms-1" />)}
    </th>
  )
}

function parsePrice(priceStr) {
  if (!priceStr || typeof priceStr !== 'string') return { amount: 0, currency: 'RUB' }
  const match = priceStr.match(/([\d\s.,]+)\s*(RUB|USD|EUR|€|₽|\$)/i) || priceStr.match(/([\d\s.,]+)\s+([A-Z]{3})\b/i)
  if (!match) return { amount: 0, currency: 'RUB' }
  const amount = parseFloat(String(match[1]).replace(/\s/g, '').replace(',', '.')) || 0
  let currency = 'RUB'
  if (match[2]) {
    if (match[2] === '€') currency = 'EUR'
    else if (match[2] === '₽' || match[2].toUpperCase() === 'RUB') currency = 'RUB'
    else if (match[2] === '$' || match[2].toUpperCase() === 'USD') currency = 'USD'
    else currency = match[2].toUpperCase()
  }
  return { amount, currency }
}

export function TariffsPage({ db, actions, settings, ratesData }) {
  const [filters, setFilters] = useState({
    search: '',
    providerId: '',
    providerAccountId: '',
    country: '',
    orderAvailable: 'all',
  })
  const [syncLoading, setSyncLoading] = useState(false)
  const [syncMessage, setSyncMessage] = useState(null)
  const [sortBy, setSortBy] = useState('name')
  const [sortDir, setSortDir] = useState('asc')

  const baseCurrency = (settings?.[0]?.baseCurrency || 'RUB').toUpperCase()

  const billmanagerAccounts = useMemo(
    () => db.providerAccounts.filter((a) => a.apiType === 'billmanager' && a.apiBaseUrl),
    [db.providerAccounts],
  )

  const filteredAndSortedTariffs = useMemo(() => {
    const filtered = db.activeTariffs.filter((item) => {
      const search = filters.search.toLowerCase()
      const bySearch =
        !search ||
        item.name?.toLowerCase().includes(search) ||
        item.desc?.toLowerCase().includes(search) ||
        item.location?.toLowerCase().includes(search) ||
        item.country?.toLowerCase().includes(search) ||
        item.datacenterName?.toLowerCase().includes(search) ||
        item.cpuModel?.toLowerCase().includes(search) ||
        String(item.vcpu || '').includes(search) ||
        String(item.ramGb || '').includes(search) ||
        String(item.diskGb || '').includes(search) ||
        item.diskType?.toLowerCase().includes(search) ||
        item.virtualization?.toLowerCase().includes(search)
      const byProvider = !filters.providerId || item.providerId === filters.providerId
      const byAccount =
        !filters.providerAccountId || item.providerAccountId === filters.providerAccountId
      const byCountry =
        !filters.country || item.country === filters.country
      const byOrderAvailable =
        filters.orderAvailable === 'all' ||
        (filters.orderAvailable === 'yes' && item.orderAvailable) ||
        (filters.orderAvailable === 'no' && !item.orderAvailable)
      return bySearch && byProvider && byAccount && byCountry && byOrderAvailable
    })

    const sorted = [...filtered].sort((a, b) => {
      let cmp = 0
      if (sortBy === 'price') {
        const pa = parsePrice(a.price)
        const pb = parsePrice(b.price)
        const va = convertCurrency(pa.amount, pa.currency, baseCurrency, ratesData)
        const vb = convertCurrency(pb.amount, pb.currency, baseCurrency, ratesData)
        cmp = va - vb
      } else if (['vcpu', 'ramGb', 'diskGb'].includes(sortBy)) {
        const va = Number(a[sortBy]) || 0
        const vb = Number(b[sortBy]) || 0
        cmp = va - vb
      } else {
        const va = String(a[sortBy] ?? '').toLowerCase()
        const vb = String(b[sortBy] ?? '').toLowerCase()
        cmp = va.localeCompare(vb)
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
    return sorted
  }, [db.activeTariffs, filters, sortBy, sortDir, baseCurrency, ratesData])

  const handleSort = (col) => {
    if (!SORT_COLUMNS.includes(col)) return
    setSortBy(col)
    setSortDir((prev) => (sortBy === col && prev === 'asc' ? 'desc' : 'asc'))
  }

  const accountFilterOptions = useMemo(
    () =>
      db.providerAccounts.filter(
        (account) => !filters.providerId || account.providerId === filters.providerId,
      ),
    [db.providerAccounts, filters.providerId],
  )

  const availableCountries = useMemo(() => {
    const filtered = db.activeTariffs.filter((item) => {
      const byProvider = !filters.providerId || item.providerId === filters.providerId
      const byAccount =
        !filters.providerAccountId || item.providerAccountId === filters.providerAccountId
      return byProvider && byAccount && item.country
    })
    const countries = [...new Set(filtered.map((t) => t.country).filter(Boolean))].sort()
    return countries
  }, [db.activeTariffs, filters.providerId, filters.providerAccountId])

  const onSync = async () => {
    if (billmanagerAccounts.length === 0) return
    setSyncLoading(true)
    setSyncMessage(null)
    let totalTariffs = 0
    let lastError = null
    for (const account of billmanagerAccounts) {
      try {
        const result = await syncAccount(account.id)
        if (result.ok) {
          totalTariffs += result.synced?.tariffsCount ?? 0
        } else {
          lastError = result.error
        }
      } catch (err) {
        lastError = err.message
      }
    }
    if (lastError && totalTariffs === 0) {
      setSyncMessage(lastError)
    } else {
      setSyncMessage(
        totalTariffs > 0
          ? `Синхронизировано: ${totalTariffs} тарифов${lastError ? `. Ошибки: ${lastError}` : ''}`
          : lastError
            ? `Ошибка: ${lastError}`
            : 'Нет новых тарифов для синхронизации',
      )
    }
    if (totalTariffs > 0) await actions.refreshData()
    setSyncLoading(false)
  }

  const resetFilters = () => {
    setFilters({
      search: '',
      providerId: '',
      providerAccountId: '',
      country: '',
      orderAvailable: 'all',
    })
  }

  const syncOptionsByAccount = useMemo(() => {
    const map = {}
    for (const opt of db.tariffSyncOptions || []) {
      map[opt.providerAccountId] = opt
    }
    return map
  }, [db.tariffSyncOptions])

  return (
    <>
      <PageHeader pretitle="Каталог хостера" title="Активные тарифы" />
      <div className="row row-cards">
        <div className="col-12 card-stack">
          {Object.keys(syncOptionsByAccount).length > 0 ? (
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">
                  <IconMapPin size={18} className="me-1" />
                  Доступные датацентры и страны
                </h3>
              </div>
              <div className="card-body">
                <div className="row g-3">
                  {Object.entries(syncOptionsByAccount).map(([accountId, opt]) => {
                    const account = db.providerAccounts.find((a) => a.id === accountId)
                    const provider = db.providers.find((p) => p.id === account?.providerId)
                    const dcs = opt.datacenters || []
                    const periods = opt.periods || []
                    if (dcs.length === 0) return null
                    return (
                      <div key={accountId} className="col-12 col-md-6 col-lg-4">
                        <div className="border rounded p-3">
                          <div className="fw-medium mb-2">
                            {provider?.name} / {account?.name}
                          </div>
                          <div className="d-flex flex-wrap gap-1">
                            {dcs.map((dc) => (
                              <span
                                key={dc.k}
                                className="badge bg-blue-lt"
                                title={`ID: ${dc.k}`}
                              >
                                {dc.v}
                              </span>
                            ))}
                          </div>
                          {periods.length > 0 ? (
                            <div className="mt-2 text-secondary small">
                              Периоды: {periods.map((p) => p.v).join(', ')}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          ) : null}
          <div className="card">
            <div className="card-body">
              <div className="row g-2">
                <div className="col-xl-3 col-lg-4 col-md-6">
                  <div className="input-icon">
                    <span className="input-icon-addon">
                      <IconSearch size={16} />
                    </span>
                    <input
                      className="form-control"
                      placeholder="Поиск по названию, ресурсам..."
                      value={filters.search}
                      onChange={(e) =>
                        setFilters((prev) => ({ ...prev, search: e.target.value }))
                      }
                    />
                  </div>
                </div>
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
                    value={filters.country}
                    onChange={(e) =>
                      setFilters((prev) => ({ ...prev, country: e.target.value }))
                    }
                  >
                    <option value="">Все страны</option>
                    {availableCountries.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-xl-2 col-lg-4 col-md-6">
                  <select
                    className="form-select"
                    value={filters.orderAvailable}
                    onChange={(e) =>
                      setFilters((prev) => ({ ...prev, orderAvailable: e.target.value }))
                    }
                  >
                    <option value="all">Доступность: все</option>
                    <option value="yes">Можно заказать</option>
                    <option value="no">Нельзя заказать</option>
                  </select>
                </div>
                <div className="col-xl-2 col-lg-4 col-md-6">
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary"
                    onClick={resetFilters}
                  >
                    Сбросить
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Список тарифов</h3>
              {syncMessage ? (
                <div
                  className={`alert alert-${
                    syncMessage.startsWith('Синхронизировано')
                      ? 'success'
                      : syncMessage.startsWith('Ошибка')
                        ? 'warning'
                        : 'secondary'
                  } py-2 mb-0 me-2`}
                >
                  {syncMessage}
                </div>
              ) : null}
              <div className="card-actions">
                {billmanagerAccounts.length > 0 ? (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={onSync}
                    disabled={syncLoading}
                    title="Синхронизировать тарифы из BILLmanager"
                  >
                    {syncLoading ? (
                      <span className="spinner-border spinner-border-sm me-1" role="status" />
                    ) : (
                      <IconRefresh size={16} className="me-1" />
                    )}
                    Синхронизировать
                  </button>
                ) : (
                  <span className="text-secondary small">
                    Добавьте аккаунт BILLmanager для синхронизации тарифов
                  </span>
                )}
              </div>
            </div>
            <div className="table-responsive">
              <table className="table card-table table-vcenter">
                <thead>
                  <tr>
                    <SortHeader column="name" onSort={handleSort} sortBy={sortBy} sortDir={sortDir}>Тариф</SortHeader>
                    <th>Хостер / Аккаунт</th>
                    <SortHeader column="vcpu" onSort={handleSort} sortBy={sortBy} sortDir={sortDir}>vCPU</SortHeader>
                    <SortHeader column="ramGb" onSort={handleSort} sortBy={sortBy} sortDir={sortDir}>RAM</SortHeader>
                    <SortHeader column="diskGb" onSort={handleSort} sortBy={sortBy} sortDir={sortDir}>Диск</SortHeader>
                    <SortHeader column="diskType" onSort={handleSort} sortBy={sortBy} sortDir={sortDir}>Тип диска</SortHeader>
                    <SortHeader column="virtualization" onSort={handleSort} sortBy={sortBy} sortDir={sortDir}>Виртуализация</SortHeader>
                    <SortHeader column="channel" onSort={handleSort} sortBy={sortBy} sortDir={sortDir}>Канал</SortHeader>
                    <SortHeader column="country" onSort={handleSort} sortBy={sortBy} sortDir={sortDir}>Страна</SortHeader>
                    <SortHeader column="location" onSort={handleSort} sortBy={sortBy} sortDir={sortDir}>Локация</SortHeader>
                    <th>CPU</th>
                    <SortHeader column="price" onSort={handleSort} sortBy={sortBy} sortDir={sortDir}>Цена</SortHeader>
                    <th>₽/vCPU</th>
                    <th>₽/GB RAM</th>
                    <th>₽/GB диск</th>
                    <th>Заказ</th>
                    <th>Панель</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAndSortedTariffs.map((item) => {
                    const provider = db.providers.find((p) => p.id === item.providerId)
                    const account = db.providerAccounts.find(
                      (a) => a.id === item.providerAccountId,
                    )
                    const { amount: priceAmount, currency: priceCurrency } = parsePrice(item.price)
                    const priceInBase = convertCurrency(priceAmount, priceCurrency, baseCurrency, ratesData)
                    const vcpu = Number(item.vcpu) || 0
                    const ramGb = Number(item.ramGb) || 0
                    const diskGb = Number(item.diskGb) || 0
                    const pricePerVcpu = vcpu > 0 ? priceInBase / vcpu : null
                    const pricePerRam = ramGb > 0 ? priceInBase / ramGb : null
                    const pricePerDisk = diskGb > 0 ? priceInBase / diskGb : null
                    return (
                      <tr key={item.id}>
                        <td>
                          <div className="d-flex align-items-center gap-2">
                            <span className="avatar avatar-sm bg-blue-lt">
                              <IconServer size={16} />
                            </span>
                            <div>
                              <div className="fw-medium">{item.name || '—'}</div>
                              {item.desc ? (
                                <div
                                  className="text-secondary small text-truncate"
                                  style={{ maxWidth: 280 }}
                                  title={item.desc}
                                >
                                  {item.desc}
                                </div>
                              ) : null}
                            </div>
                          </div>
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
                            <span>{provider?.name || '—'}</span>
                          </div>
                          <div className="text-secondary small">{account?.name || '—'}</div>
                        </td>
                        <td>
                          <span className="badge bg-azure-lt">{item.vcpu || '—'}</span>
                        </td>
                        <td>
                          <span className="badge bg-lime-lt">
                            {item.ramGb ? `${item.ramGb} GB` : '—'}
                          </span>
                        </td>
                        <td>
                          <span className="badge bg-orange-lt">
                            {item.diskGb ? `${item.diskGb} GB` : '—'}
                          </span>
                        </td>
                        <td>{item.diskType || '—'}</td>
                        <td>{item.virtualization || '—'}</td>
                        <td>{item.channel || '—'}</td>
                        <td>
                          {item.country ? (
                            <span className="badge bg-cyan-lt">{item.country}</span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td>{item.location || item.datacenterName || '—'}</td>
                        <td>
                          {item.cpuModel ? (
                            <span className="text-secondary small" title={item.cpuModel}>
                              {item.cpuModel.length > 20 ? `${item.cpuModel.slice(0, 20)}…` : item.cpuModel}
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td>
                          <span
                            className={
                              item.orderAvailable ? 'text-success' : 'text-secondary'
                            }
                          >
                            {item.price || '—'}
                          </span>
                        </td>
                        <td>
                          <span className="text-secondary small">
                            {pricePerVcpu != null
                              ? formatCurrency(pricePerVcpu, baseCurrency)
                              : '—'}
                          </span>
                        </td>
                        <td>
                          <span className="text-secondary small">
                            {pricePerRam != null
                              ? formatCurrency(pricePerRam, baseCurrency)
                              : '—'}
                          </span>
                        </td>
                        <td>
                          <span className="text-secondary small">
                            {pricePerDisk != null
                              ? formatCurrency(pricePerDisk, baseCurrency)
                              : '—'}
                          </span>
                        </td>
                        <td>
                          <span
                            className={`badge ${
                              item.orderAvailable ? 'bg-green-lt text-green' : 'bg-secondary-lt'
                            }`}
                          >
                            {item.orderAvailable ? 'Да' : 'Нет'}
                          </span>
                        </td>
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
                      </tr>
                    )
                  })}
                  {filteredAndSortedTariffs.length === 0 ? (
                    <EmptyState
                      message={
                        db.activeTariffs.length === 0
                          ? 'Нет данных. Синхронизируйте тарифы из BILLmanager.'
                          : 'По фильтрам ничего не найдено'
                      }
                      colSpan={17}
                    />
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
