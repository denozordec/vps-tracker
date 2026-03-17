import { useMemo } from 'react'
import {
  billingModeLabel,
  convertCurrency,
  formatCurrency,
  monthKey,
} from '../lib/utils'
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
  const vps = Array.isArray(db.vps) ? db.vps : []
  const providerAccounts = Array.isArray(db.providerAccounts) ? db.providerAccounts : []
  const balanceLedger = Array.isArray(db.balanceLedger) ? db.balanceLedger : []
  const payments = Array.isArray(db.payments) ? db.payments : []
  const providers = Array.isArray(db.providers) ? db.providers : []

  const now = new Date()
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const baseCurrency = settings?.[0]?.baseCurrency || 'RUB'

  const activeVpsCount = vps.filter((item) => item.status === 'active').length

  const monthForecast = useMemo(() => {
    return vps
      .filter((item) => item.status === 'active')
      .reduce((acc, item) => {
        const tariffType = item.tariffType || (Number(item.dailyRate || 0) > 0 ? 'daily' : 'monthly')
        const amount =
          tariffType === 'daily'
            ? Number(item.dailyRate || 0) * 30
            : Number(item.monthlyRate || 0)
        return acc + convertCurrency(amount, item.currency || 'USD', baseCurrency, ratesData)
      }, 0)
  }, [vps, baseCurrency, ratesData])

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

  const accountBalances = providerAccounts.map((account) => {
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
  const upcoming = providerAccounts
    .map((account) => ({
      ...account,
      nextDate:
        account.billingMode === 'daily'
          ? new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
          : new Date(now.getFullYear(), now.getMonth() + 1, 1),
    }))
    .sort((a, b) => a.nextDate - b.nextDate)
    .slice(0, 5)

  return (
    <>
      <PageHeader pretitle="Обзор" title="Дашборд" />
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

      <div className="col-12 col-xl-7">
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

      <div className="col-12 col-xl-5">
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Ближайшие списания</h3>
          </div>
          <div className="list-group list-group-flush">
            {upcoming.map((item) => (
              <div key={item.id} className="list-group-item">
                <div className="d-flex justify-content-between">
                  <div>
                    <div className="fw-medium">{item.name}</div>
                    <div className="text-secondary small">{billingModeLabel(item.billingMode)}</div>
                  </div>
                  <div className="text-secondary">
                    {item.nextDate.toLocaleDateString('ru-RU')}
                  </div>
                </div>
              </div>
            ))}
            {upcoming.length === 0 ? (
              <div className="list-group-item text-secondary text-center py-4">Списаний пока нет</div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
    </>
  )
}
