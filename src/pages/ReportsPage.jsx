import { useMemo, useState } from 'react'
import {
  convertCurrency,
  downloadTextFile,
  formatCurrency,
  monthKey,
  toCsv,
  vpsStatusLabel,
} from '../lib/utils'
import { ConvertedAmount } from '../components/ConvertedAmount'
import { EmptyState } from '../components/EmptyState'
import { PageHeader } from '../components/PageHeader'

export function ReportsPage({ db, settings, ratesData }) {
  const [filters, setFilters] = useState({
    providerId: '',
    country: '',
    month: '',
  })

  const rows = useMemo(() => {
    return db.vps
      .filter((vps) => {
        const byProvider = !filters.providerId || vps.providerId === filters.providerId
        const byCountry =
          !filters.country || vps.country?.toLowerCase().includes(filters.country.toLowerCase())
        return byProvider && byCountry
      })
      .map((vps) => {
        const provider = db.providers.find((item) => item.id === vps.providerId)
        const payments = db.payments.filter((item) => item.vpsId === vps.id)
        const monthlyPayments = filters.month
          ? payments.filter((item) => monthKey(item.date) === filters.month)
          : payments
        const total = monthlyPayments.reduce((acc, item) => acc + Number(item.amount || 0), 0)
        return {
          providerId: vps.providerId,
          provider: provider?.name || '-',
          vps: vps.dns || vps.ip,
          ip: vps.ip,
          country: vps.country || '',
          city: vps.city || '',
          status: vps.status,
          expense: Number(total.toFixed(2)),
          currency: vps.currency || 'USD',
        }
      })
  }, [db.payments, db.providers, db.vps, filters])

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
                <select
                  className="form-select"
                  value={filters.providerId}
                  onChange={(e) => setFilters((prev) => ({ ...prev, providerId: e.target.value }))}
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
                <label className="form-label">Страна</label>
                <input
                  className="form-control"
                  value={filters.country}
                  onChange={(e) => setFilters((prev) => ({ ...prev, country: e.target.value }))}
                  placeholder="например Германия"
                />
              </div>
              <div className="col-12 col-md-6 col-xl-3">
                <label className="form-label">Период (YYYY-MM)</label>
                <input
                  className="form-control"
                  value={filters.month}
                  onChange={(e) => setFilters((prev) => ({ ...prev, month: e.target.value }))}
                  placeholder="2026-03"
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
                  <EmptyState message="Нет данных под фильтр" colSpan={5} />
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
