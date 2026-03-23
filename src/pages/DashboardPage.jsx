import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { convertCurrency, effectiveVpsTariffCurrency, formatCurrency, monthKey } from '../lib/utils'
import { getPaidUntilDate as computePaidUntil } from '../lib/paid-until'
import { computeInventoryHealth, formatSyncSummaryLine } from '../lib/inventory-health'
import { fetchSyncStatus } from '../lib/api'
import { ConvertedAmount } from '../components/ConvertedAmount'
import { EmptyState } from '../components/EmptyState'
import { ExpenseChart } from '../components/ExpenseChart'
import { PageHeader } from '../components/PageHeader'
import { ProviderPieChart } from '../components/ProviderPieChart'
import {
  IconCash,
  IconClockHour4,
  IconServer,
  IconWallet,
} from '@tabler/icons-react'

export function DashboardPage({ db = {}, settings, ratesData }) {
  const [dashTab, setDashTab] = useState('overview')
  const vps = Array.isArray(db.vps) ? db.vps : []
  const providerAccounts = Array.isArray(db.providerAccounts) ? db.providerAccounts : []
  const balanceLedger = Array.isArray(db.balanceLedger) ? db.balanceLedger : []
  const payments = Array.isArray(db.payments) ? db.payments : []
  const providers = Array.isArray(db.providers) ? db.providers : []

  const [syncLogRows, setSyncLogRows] = useState([])
  useEffect(() => {
    fetchSyncStatus()
      .then(setSyncLogRows)
      .catch(() => setSyncLogRows([]))
  }, [db.vps?.length, db.providerAccounts?.length])

  const now = new Date()
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const baseCurrency = settings?.[0]?.baseCurrency || 'RUB'

  const activeVpsCount = vps.filter((item) => item.status === 'active').length

  const providerById = useMemo(
    () => new Map(providers.map((p) => [p.id, p])),
    [providers],
  )

  const monthForecast = useMemo(() => {
    return vps
      .filter((item) => item.status === 'active')
      .reduce((acc, item) => {
        const tariffType = item.tariffType || (Number(item.dailyRate || 0) > 0 ? 'daily' : 'monthly')
        const amount =
          tariffType === 'daily'
            ? Number(item.dailyRate || 0) * 30
            : Number(item.monthlyRate || 0)
        const cur = effectiveVpsTariffCurrency(item, providerById.get(item.providerId))
        return acc + convertCurrency(amount, cur, baseCurrency, ratesData)
      }, 0)
  }, [vps, baseCurrency, ratesData, providerById])

  const monthExpenses = useMemo(() => {
    return [...payments, ...balanceLedger]
    .filter((item) => monthKey(item.date) === currentMonth)
    .filter((item) => {
      if (item.type === 'provider_balance_topup') {
        return false
      }
      return true
    })
    .reduce(
      (acc, item) =>
        acc + convertCurrency(item.amount || 0, item.currency || 'USD', baseCurrency, ratesData),
      0,
    )
  }, [payments, balanceLedger, currentMonth, baseCurrency, ratesData])

  const prevMonthKey = useMemo(() => {
    const d = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  }, [currentMonth])

  const prevMonthExpenses = useMemo(() => {
    return [...payments, ...balanceLedger]
      .filter((item) => monthKey(item.date) === prevMonthKey)
      .filter((item) => item.type !== 'provider_balance_topup')
      .reduce(
        (acc, item) =>
          acc + convertCurrency(item.amount || 0, item.currency || 'USD', baseCurrency, ratesData),
        0,
      )
  }, [payments, balanceLedger, prevMonthKey, baseCurrency, ratesData])

  const monthlyExpenseData = useMemo(() => {
    const months = []
    const now = new Date()
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const amount = [...payments, ...balanceLedger]
        .filter((item) => monthKey(item.date) === key)
        .filter((item) => item.type !== 'provider_balance_topup')
        .reduce(
          (acc, item) =>
            acc + convertCurrency(item.amount || 0, item.currency || 'USD', baseCurrency, ratesData),
          0,
        )
      months.push({
        monthKey: key,
        monthLabel: d.toLocaleDateString('ru-RU', { month: 'short', year: '2-digit' }),
        amount,
      })
    }
    return months
  }, [payments, balanceLedger, baseCurrency, ratesData])

  const providerExpenseData = useMemo(() => {
    const byProvider = {}
    ;[...payments, ...balanceLedger]
      .filter((item) => item.type !== 'provider_balance_topup')
      .forEach((item) => {
        const vpsItem = item.vpsId ? vps.find((v) => v.id === item.vpsId) : null
        const providerId = vpsItem?.providerId || (item.providerAccountId
          ? providerAccounts.find((a) => a.id === item.providerAccountId)?.providerId
          : null)
        const pid = providerId || 'unknown'
        if (!byProvider[pid]) byProvider[pid] = 0
        byProvider[pid] += convertCurrency(
          item.amount || 0,
          item.currency || 'USD',
          baseCurrency,
          ratesData,
        )
      })
    return Object.entries(byProvider).map(([providerId, amount]) => ({
      providerId,
      providerName: providerId === 'unknown' ? '—' : (providers.find((p) => p.id === providerId)?.name || providerId),
      amount,
    }))
  }, [payments, balanceLedger, vps, providerAccounts, providers, baseCurrency, ratesData])

  const forecastByProject = useMemo(() => {
    const map = {}
    for (const item of vps.filter((x) => x.status === 'active')) {
      const key = (item.project || '').trim() || '__none__'
      const label = key === '__none__' ? 'Без проекта' : key
      if (!map[key]) {
        map[key] = { key, label, count: 0, forecast: 0 }
      }
      map[key].count += 1
      const tariffType = item.tariffType || (Number(item.dailyRate || 0) > 0 ? 'daily' : 'monthly')
      const amount =
        tariffType === 'daily'
          ? Number(item.dailyRate || 0) * 30
          : Number(item.monthlyRate || 0)
      const cur = effectiveVpsTariffCurrency(item, providerById.get(item.providerId))
      map[key].forecast += convertCurrency(amount, cur, baseCurrency, ratesData)
    }
    return Object.values(map).sort((a, b) => {
      if (a.key === '__none__') return 1
      if (b.key === '__none__') return -1
      return a.label.localeCompare(b.label, 'ru')
    })
  }, [vps, baseCurrency, ratesData, providerById])

  const forecastByAccount = useMemo(() => {
    return providerAccounts
      .map((acc) => {
        const items = vps.filter((x) => x.providerAccountId === acc.id && x.status === 'active')
        let forecast = 0
        for (const item of items) {
          const tariffType = item.tariffType || (Number(item.dailyRate || 0) > 0 ? 'daily' : 'monthly')
          const amount =
            tariffType === 'daily'
              ? Number(item.dailyRate || 0) * 30
              : Number(item.monthlyRate || 0)
          const cur = effectiveVpsTariffCurrency(item, providerById.get(item.providerId))
          forecast += convertCurrency(amount, cur, baseCurrency, ratesData)
        }
        return { account: acc, count: items.length, forecast }
      })
      .filter((row) => row.count > 0)
      .sort((a, b) => b.forecast - a.forecast)
  }, [vps, providerAccounts, baseCurrency, ratesData, providerById])

  const accountBalances = providerAccounts.map((account) => {
    if (account.balance_api != null && Number.isFinite(Number(account.balance_api))) {
      return {
        ...account,
        balance: Number(account.balance_api),
        currency: account.balance_currency || account.currency,
      }
    }
    const ledgerRows = balanceLedger.filter((row) => row.providerAccountId === account.id)
    const credits = ledgerRows
      .filter((row) => row.direction === 'credit')
      .reduce((acc, row) => acc + Number(row.amount || 0), 0)
    const debits = ledgerRows
      .filter((row) => row.direction === 'debit')
      .reduce((acc, row) => acc + Number(row.amount || 0), 0)
    return { ...account, balance: credits - debits }
  })

  const totalBalance = accountBalances.reduce(
    (acc, row) => acc + convertCurrency(row.balance, row.currency, baseCurrency, ratesData),
    0,
  )

  const UPCOMING_DAYS = 7
  const paidUntilCtx = { vps, providerAccounts, payments, balanceLedger, now }
  const getPaidUntilDate = (item) => computePaidUntil(item, paidUntilCtx)

  const inventoryIssues = useMemo(
    () =>
      computeInventoryHealth({
        vps,
        providerAccounts,
        providers,
        payments,
        balanceLedger,
        syncLog: syncLogRows,
      }),
    [vps, providerAccounts, providers, payments, balanceLedger, syncLogRows],
  )

  const recentSyncFeed = useMemo(() => {
    return [...syncLogRows]
      .filter((r) => r.finishedAt && (r.status === 'ok' || r.status === 'error'))
      .slice(0, 12)
  }, [syncLogRows])

  const upcomingThreshold = new Date(now)
  upcomingThreshold.setDate(upcomingThreshold.getDate() + UPCOMING_DAYS)
  const todayStartForUpcoming = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const upcoming = vps
    .filter((item) => item.status === 'active')
    .map((item) => {
      const date = getPaidUntilDate(item)
      return { vps: item, paidUntil: date }
    })
    .filter(
      ({ paidUntil }) =>
        paidUntil &&
        paidUntil <= upcomingThreshold &&
        paidUntil >= todayStartForUpcoming,
    )
    .sort((a, b) => a.paidUntil - b.paidUntil)
    .slice(0, 10)

  const healthIssuesCount = inventoryIssues.reduce((n, i) => n + (i.count || 0), 0)

  return (
    <>
      <PageHeader pretitle="Обзор" title="Дашборд" />
      <ul className="nav nav-tabs mb-3" role="tablist">
        <li className="nav-item" role="presentation">
          <button
            type="button"
            className={`nav-link ${dashTab === 'overview' ? 'active' : ''}`}
            onClick={() => setDashTab('overview')}
          >
            Обзор
          </button>
        </li>
        <li className="nav-item" role="presentation">
          <button
            type="button"
            className={`nav-link ${dashTab === 'health' ? 'active' : ''}`}
            onClick={() => setDashTab('health')}
          >
            Health Check
            {inventoryIssues.length > 0 ? (
              <span className="badge bg-orange-lt text-orange ms-2">{healthIssuesCount}</span>
            ) : null}
          </button>
        </li>
      </ul>

      {dashTab === 'overview' ? (
      <div className="row row-cards">
      <div className="col-sm-6 col-lg-3">
        <div className="card metric-card metric-blue h-100">
          <div className="card-body">
            <div className="d-flex align-items-center justify-content-between">
              <div className="text-secondary">Активные VPS</div>
              <span className="metric-icon bg-blue-lt text-blue">
                <IconServer size={18} />
              </span>
            </div>
            <div className="stat-value">{activeVpsCount}</div>
          </div>
        </div>
      </div>
      <div className="col-sm-6 col-lg-3">
        <div className="card metric-card metric-green h-100">
          <div className="card-body">
            <div className="d-flex align-items-center justify-content-between">
              <div className="text-secondary">Расходы за месяц</div>
              <span className="metric-icon bg-green-lt text-green">
                <IconCash size={18} />
              </span>
            </div>
            <div className="stat-value">{formatCurrency(monthExpenses, baseCurrency)}</div>
            <div className="text-secondary small mt-1">
              Прогноз: {formatCurrency(monthForecast, baseCurrency)}
            </div>
            <div className="text-secondary small">
              Прошлый месяц: {formatCurrency(prevMonthExpenses, baseCurrency)}
            </div>
          </div>
        </div>
      </div>
      <div className="col-sm-6 col-lg-3">
        <div className="card metric-card metric-yellow h-100">
          <div className="card-body">
            <div className="d-flex align-items-center justify-content-between">
              <div className="text-secondary">Аккаунтов хостеров</div>
              <span className="metric-icon bg-yellow-lt text-yellow">
                <IconClockHour4 size={18} />
              </span>
            </div>
            <div className="stat-value">{providerAccounts.length}</div>
          </div>
        </div>
      </div>
      <div className="col-sm-6 col-lg-3">
        <div className="card metric-card metric-purple h-100">
          <div className="card-body">
            <div className="d-flex align-items-center justify-content-between">
              <div className="text-secondary">Суммарный баланс</div>
              <span className="metric-icon bg-purple-lt text-purple">
                <IconWallet size={18} />
              </span>
            </div>
            <div className="stat-value">{formatCurrency(totalBalance, baseCurrency)}</div>
          </div>
        </div>
      </div>

      <div className="col-12 col-xl-8">
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Остатки по аккаунтам хостеров</h3>
          </div>
          <div className="table-responsive">
            <table className="table card-table table-vcenter">
              <thead>
                <tr>
                  <th>Аккаунт</th>
                  <th>Валюта</th>
                  <th>Баланс</th>
                </tr>
              </thead>
              <tbody>
                {accountBalances.map((item) => (
                  <tr key={item.id}>
                    <td>{item.name}</td>
                    <td>{item.currency}</td>
                    <td>
                      <ConvertedAmount
                        amount={item.balance}
                        currency={item.currency}
                        provider={db.providers.find((provider) => provider.id === item.providerId)}
                        settings={settings}
                        ratesData={ratesData}
                      />
                    </td>
                  </tr>
                ))}
                {accountBalances.length === 0 ? (
                  <EmptyState message="Пока нет аккаунтов" colSpan={3} />
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="col-12 col-xl-4">
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Истекающая оплата (ближайшие {UPCOMING_DAYS} дней)</h3>
          </div>
          <div className="list-group list-group-flush">
            {upcoming.map(({ vps: item, paidUntil }) => {
              const provider = providers.find((p) => p.id === item.providerId)
              const account = providerAccounts.find((a) => a.id === item.providerAccountId)
              return (
                <div key={item.id} className="list-group-item">
                  <div className="d-flex justify-content-between">
                    <div>
                      <div className="fw-medium">{item.dns || item.ip}</div>
                      <div className="text-secondary small">
                        {provider?.name || '—'} / {account?.name || '—'}
                      </div>
                    </div>
                    <div className="text-secondary">
                      {paidUntil.toLocaleDateString('ru-RU')}
                    </div>
                  </div>
                </div>
              )
            })}
            {upcoming.length === 0 ? (
              <div className="list-group-item text-secondary text-center py-4">
                Нет VPS с истекающей оплатой в ближайшие {UPCOMING_DAYS} дней
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="col-12 col-xl-6">
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Расходы по месяцам</h3>
          </div>
          <div className="card-body">
            <ExpenseChart
              data={monthlyExpenseData}
              baseCurrency={baseCurrency}
              formatCurrency={formatCurrency}
            />
          </div>
        </div>
      </div>

      <div className="col-12 col-xl-6">
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Расходы по хостеру</h3>
          </div>
          <div className="card-body">
            <ProviderPieChart
              data={providerExpenseData}
              baseCurrency={baseCurrency}
              formatCurrency={formatCurrency}
            />
          </div>
        </div>
      </div>

      <div className="col-12 col-xl-6">
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Прогноз по проектам (активные VPS)</h3>
          </div>
          <div className="table-responsive">
            <table className="table card-table table-vcenter">
              <thead>
                <tr>
                  <th>Проект / пул</th>
                  <th className="text-end">VPS</th>
                  <th className="text-end">Прогноз / мес</th>
                </tr>
              </thead>
              <tbody>
                {forecastByProject.map((row) => (
                  <tr key={row.key}>
                    <td>{row.label}</td>
                    <td className="text-end">{row.count}</td>
                    <td className="text-end">{formatCurrency(row.forecast, baseCurrency)}</td>
                  </tr>
                ))}
                {forecastByProject.length === 0 ? (
                  <EmptyState message="Нет активных VPS" colSpan={3} />
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="col-12 col-xl-6">
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Прогноз по аккаунтам (активные VPS)</h3>
          </div>
          <div className="table-responsive">
            <table className="table card-table table-vcenter">
              <thead>
                <tr>
                  <th>Аккаунт</th>
                  <th className="text-end">VPS</th>
                  <th className="text-end">Прогноз / мес</th>
                </tr>
              </thead>
              <tbody>
                {forecastByAccount.map((row) => (
                  <tr key={row.account.id}>
                    <td>{row.account.name}</td>
                    <td className="text-end">{row.count}</td>
                    <td className="text-end">{formatCurrency(row.forecast, baseCurrency)}</td>
                  </tr>
                ))}
                {forecastByAccount.length === 0 ? (
                  <EmptyState message="Нет активных VPS по аккаунтам" colSpan={3} />
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
      ) : null}

      {dashTab === 'health' ? (
      <div className="row row-cards">
        <div className="col-12">
          <div className={`card ${inventoryIssues.length > 0 ? 'border-warning' : ''}`}>
            <div className="card-header">
              <h3 className="card-title">Health Check</h3>
            </div>
            <div className="card-body">
              {inventoryIssues.length > 0 ? (
                <div className="row g-2">
                  {inventoryIssues.map((issue) => (
                    <div className="col-md-6 col-xl-4" key={issue.key}>
                      <Link className="card card-link" to={issue.to}>
                        <div className="card-body py-2 px-3">
                          <div className="d-flex justify-content-between align-items-center">
                            <span className="fw-medium">{issue.title}</span>
                            <span className="badge bg-orange-lt text-orange">{issue.count}</span>
                          </div>
                          {issue.hint ? <div className="text-secondary small mt-1">{issue.hint}</div> : null}
                        </div>
                      </Link>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-secondary text-center py-4">
                  Замечаний по инвентарю нет. При появлении проблем они отобразятся здесь со ссылками на списки.
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="col-12">
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Последние синхронизации</h3>
              <div className="card-actions">
                <Link to="/accounts" className="btn btn-sm btn-outline-secondary">
                  Аккаунты
                </Link>
              </div>
            </div>
            <div className="list-group list-group-flush">
              {recentSyncFeed.map((row) => {
                const acc = providerAccounts.find((a) => a.id === row.accountId)
                const line = formatSyncSummaryLine(row.summary)
                return (
                  <div key={row.id} className="list-group-item">
                    <div className="d-flex justify-content-between align-items-start gap-2">
                      <div>
                        <div className="fw-medium">{acc?.name || row.accountId}</div>
                        <div className="text-secondary small">
                          {row.status === 'error' ? (
                            <span className="text-danger">{row.error || line}</span>
                          ) : (
                            line || 'OK'
                          )}
                        </div>
                      </div>
                      <span className={`badge ${row.status === 'ok' ? 'bg-green-lt text-green' : 'bg-red-lt text-red'}`}>
                        {row.status === 'ok' ? 'OK' : 'Ошибка'}
                      </span>
                    </div>
                    <div className="text-secondary small mt-1">
                      {row.finishedAt
                        ? new Date(row.finishedAt).toLocaleString('ru-RU')
                        : '—'}
                    </div>
                  </div>
                )
              })}
              {recentSyncFeed.length === 0 ? (
                <div className="list-group-item text-secondary text-center py-4">
                  Запустите синхронизацию на странице аккаунтов — здесь появится краткий итог
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
      ) : null}
    </>
  )
}
