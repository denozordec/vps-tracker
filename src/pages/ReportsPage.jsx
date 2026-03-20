import { useMemo, useState } from 'react'
import {
  convertCurrency,
  downloadTextFile,
  formatCurrency,
  toCsv,
  vpsStatusLabel,
} from '../lib/utils'
import { ConvertedAmount } from '../components/ConvertedAmount'
import { EmptyState } from '../components/EmptyState'
import { PageHeader } from '../components/PageHeader'
import { noBrowserSuggestProps } from '../lib/noBrowserSuggestProps'

function isDateInRange(dateStr, dateFrom, dateTo) {
  if (!dateStr) return false
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return false
  if (dateFrom && d < new Date(dateFrom)) return false
  if (dateTo && d > new Date(dateTo + 'T23:59:59.999')) return false
  return true
}

export function ReportsPage({ db, settings, ratesData }) {
  const [filters, setFilters] = useState({
    providerId: '',
    providerAccountId: '',
    project: '',
    country: '',
    month: '',
    dateFrom: '',
    dateTo: '',
  })

  const projectNameOptions = useMemo(() => {
    const names = new Set()
    for (const p of db.serverProjects || []) {
      if ((p.name || '').trim()) names.add(p.name.trim())
    }
    for (const v of db.vps || []) {
      const p = (v.project || '').trim()
      if (p) names.add(p)
    }
    return [...names].sort((a, b) => a.localeCompare(b, 'ru'))
  }, [db.serverProjects, db.vps])

  const accountFilterOptions = useMemo(
    () =>
      (db.providerAccounts || []).filter(
        (account) => !filters.providerId || account.providerId === filters.providerId,
      ),
    [db.providerAccounts, filters.providerId],
  )

  const rows = useMemo(() => {
    const dateFrom = filters.dateFrom || (filters.month ? `${filters.month}-01` : '')
    const dateTo = filters.dateTo || (filters.month ? (() => {
      const [y, m] = filters.month.split('-').map(Number)
      const lastDay = new Date(y, m, 0).getDate()
      return `${filters.month}-${String(lastDay).padStart(2, '0')}`
    })() : '')

    const filteredVps = (db.vps || []).filter((vps) => {
      const byProvider = !filters.providerId || vps.providerId === filters.providerId
      const byAccount =
        !filters.providerAccountId || vps.providerAccountId === filters.providerAccountId
      const proj = (vps.project || '').trim()
      const byProject =
        !filters.project ||
        (filters.project === '__none__' ? !proj : proj === filters.project)
      const byCountry =
        !filters.country || vps.country?.toLowerCase().includes(filters.country.toLowerCase())
      return byProvider && byAccount && byProject && byCountry
    })

    const vpsByAccount = new Map()
    for (const v of filteredVps) {
      const aid = v.providerAccountId || ''
      if (!vpsByAccount.has(aid)) vpsByAccount.set(aid, [])
      vpsByAccount.get(aid).push(v)
    }

    return filteredVps.map((vps) => {
      const provider = db.providers.find((item) => item.id === vps.providerId)
      const account = db.providerAccounts?.find((a) => a.id === vps.providerAccountId)
      const vpsIdNorm = (id) => (id == null || id === '' ? '' : String(id))

      const paymentsDirect = (db.payments || []).filter(
        (item) =>
          vpsIdNorm(item.vpsId) === vps.id &&
          item.type !== 'provider_balance_topup' &&
          (!dateFrom || !dateTo || isDateInRange(item.date, dateFrom, dateTo)),
      )
      const singleVpsInAccount = (vpsByAccount.get(vps.providerAccountId || '') || []).length === 1
      const paymentsAccountLevel = singleVpsInAccount
        ? (db.payments || []).filter(
            (item) =>
              item.providerAccountId === vps.providerAccountId &&
              vpsIdNorm(item.vpsId) === '' &&
              item.type !== 'provider_balance_topup' &&
              (!dateFrom || !dateTo || isDateInRange(item.date, dateFrom, dateTo)),
          )
        : []

      const debitsDirect = (db.balanceLedger || []).filter(
        (item) =>
          vpsIdNorm(item.vpsId) === vps.id &&
          item.direction === 'debit' &&
          (!dateFrom || !dateTo || isDateInRange(item.date, dateFrom, dateTo)),
      )
      const debitsAccountLevel = singleVpsInAccount
        ? (db.balanceLedger || []).filter(
            (item) =>
              item.providerAccountId === vps.providerAccountId &&
              vpsIdNorm(item.vpsId) === '' &&
              item.direction === 'debit' &&
              (!dateFrom || !dateTo || isDateInRange(item.date, dateFrom, dateTo)),
          )
        : []

      const allPayments = [...paymentsDirect, ...paymentsAccountLevel]
      const allDebits = [...debitsDirect, ...debitsAccountLevel]
      const totalPayments = allPayments.reduce((acc, item) => acc + Number(item.amount || 0), 0)
      const totalDebits = allDebits.reduce((acc, item) => acc + Number(item.amount || 0), 0)
      const total = totalPayments + totalDebits

      return {
        providerId: vps.providerId,
        provider: provider?.name || '-',
        account: account?.name || '-',
        project: (vps.project || '').trim() || '—',
        vps: vps.dns || vps.ip,
        ip: vps.ip,
        country: vps.country || '',
        city: vps.city || '',
        status: vps.status,
        expense: Number(total.toFixed(2)),
        currency: vps.currency || 'USD',
      }
    })
  }, [db.payments, db.balanceLedger, db.providers, db.providerAccounts, db.vps, filters])

  const baseCurrency = settings?.[0]?.baseCurrency || 'RUB'
  const totalExpense = rows.reduce(
    (acc, row) => acc + convertCurrency(row.expense, row.currency, baseCurrency, ratesData),
    0,
  )

  return (
    <>
      <PageHeader pretitle="Аналитика" title="Отчёты" />
      <div className="row row-cards">
      <div className="col-12">
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Фильтры и экспорт</h3>
          </div>
          <div className="card-body">
            <div className="row g-2 align-items-end">
              <div className="col-12 col-md-6 col-xl-3">
                <label className="form-label">Хостер</label>
                <select autoComplete="off"
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
              <div className="col-12 col-md-6 col-xl-3">
                <label className="form-label">Аккаунт</label>
                <select autoComplete="off"
                  className="form-select"
                  value={filters.providerAccountId}
                  onChange={(e) =>
                    setFilters((prev) => ({ ...prev, providerAccountId: e.target.value }))
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
              <div className="col-12 col-md-6 col-xl-3">
                <label className="form-label">Проект / пул</label>
                <select autoComplete="off"
                  className="form-select"
                  value={filters.project}
                  onChange={(e) => setFilters((prev) => ({ ...prev, project: e.target.value }))}
                >
                  <option value="">Все проекты</option>
                  <option value="__none__">Без проекта</option>
                  {projectNameOptions.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-12 col-md-6 col-xl-3">
                <label className="form-label">Страна</label>
                <input {...noBrowserSuggestProps}
                  className="form-control"
                  value={filters.country}
                  onChange={(e) => setFilters((prev) => ({ ...prev, country: e.target.value }))}
                  placeholder="например Германия"
                />
              </div>
              <div className="col-12 col-md-6 col-xl-2">
                <label className="form-label">Период (YYYY-MM)</label>
                <input {...noBrowserSuggestProps}
                  className="form-control"
                  value={filters.month}
                  onChange={(e) =>
                    setFilters((prev) => ({
                      ...prev,
                      month: e.target.value,
                      dateFrom: '',
                      dateTo: '',
                    }))
                  }
                  placeholder="2026-03"
                />
              </div>
              <div className="col-12 col-md-6 col-xl-2">
                <label className="form-label">Дата с</label>
                <input {...noBrowserSuggestProps}
                  type="date"
                  className="form-control"
                  value={filters.dateFrom}
                  onChange={(e) =>
                    setFilters((prev) => ({
                      ...prev,
                      dateFrom: e.target.value,
                      month: '',
                    }))
                  }
                />
              </div>
              <div className="col-12 col-md-6 col-xl-2">
                <label className="form-label">Дата по</label>
                <input {...noBrowserSuggestProps}
                  type="date"
                  className="form-control"
                  value={filters.dateTo}
                  onChange={(e) =>
                    setFilters((prev) => ({
                      ...prev,
                      dateTo: e.target.value,
                      month: '',
                    }))
                  }
                />
              </div>
              <div className="col-12 col-md-6 col-xl-3">
                <button
                  type="button"
                  className="btn btn-primary w-100"
                  onClick={() => {
                    const csv = toCsv(rows)
                    downloadTextFile('vps-report.csv', csv)
                  }}
                >
                  Экспорт CSV
                </button>
              </div>
              <div className="col-12 col-md-6 col-xl-3">
                <button
                  type="button"
                  className="btn btn-outline-secondary w-100"
                  onClick={() => {
                    downloadTextFile(
                      'vps-tracker-backup.json',
                      JSON.stringify(db, null, 2),
                    )
                  }}
                >
                  Резервная копия JSON
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="col-12">
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Сводный отчет</h3>
            <div className="card-actions text-secondary">
              Итого: {formatCurrency(totalExpense, baseCurrency)}
            </div>
          </div>
          <div className="table-responsive">
            <table className="table card-table table-vcenter">
              <thead>
                <tr>
                  <th>Хостер</th>
                  <th>Аккаунт</th>
                  <th>Проект</th>
                  <th>VPS</th>
                  <th>Локация</th>
                  <th>Статус</th>
                  <th>Расход</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={`${row.ip}-${row.vps}`}>
                    <td>{row.provider}</td>
                    <td>{row.account}</td>
                    <td>{row.project}</td>
                    <td>
                      <div>{row.vps}</div>
                      <div className="text-secondary">{row.ip}</div>
                    </td>
                    <td>
                      {row.country} / {row.city}
                    </td>
                    <td>{vpsStatusLabel(row.status)}</td>
                    <td>
                      <ConvertedAmount
                        amount={row.expense}
                        currency={row.currency}
                        provider={db.providers.find((item) => item.id === row.providerId)}
                        settings={settings}
                        ratesData={ratesData}
                      />
                    </td>
                  </tr>
                ))}
                {rows.length === 0 ? (
                  <EmptyState message="Нет данных под фильтр" colSpan={7} />
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
