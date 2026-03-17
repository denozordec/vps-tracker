import { useMemo, useState } from 'react'
import {
  billingModeLabel,
  paymentTypeLabel,
} from '../lib/utils'
import { UiModal } from '../components/UiModal'
import { EmptyState } from '../components/EmptyState'
import { PageHeader } from '../components/PageHeader'
import { ConvertedAmount } from '../components/ConvertedAmount'

const emptyForm = {
  type: 'daily_debit',
  providerAccountId: '',
  vpsId: '',
  date: new Date().toISOString().slice(0, 10),
  amount: '',
  currency: 'USD',
  note: '',
}

export function BalancePage({ db, actions, settings, ratesData }) {
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)

  const vpsOptions = useMemo(
    () => db.vps.filter((vps) => !form.providerAccountId || vps.providerAccountId === form.providerAccountId),
    [db.vps, form.providerAccountId],
  )

  const accountBalances = useMemo(() => {
    return db.providerAccounts.map((account) => {
      const records = db.balanceLedger.filter((item) => item.providerAccountId === account.id)
      const value = records.reduce((acc, row) => {
        const amount = Number(row.amount || 0)
        return row.direction === 'credit' ? acc + amount : acc - amount
      }, 0)
      return { ...account, balance: value }
    })
  }, [db.balanceLedger, db.providerAccounts])

  const onSubmit = (event) => {
    event.preventDefault()
    const amount = Number(form.amount)
    if (!form.providerAccountId) {
      setError('Выберите аккаунт')
      return
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Сумма должна быть больше 0')
      return
    }
    setError('')
    actions.create('balanceLedger', {
      type: form.type,
      providerAccountId: form.providerAccountId,
      vpsId: form.vpsId || '',
      date: form.date,
      amount,
      currency: form.currency,
      direction: 'debit',
      note: form.note,
    })
    setForm(emptyForm)
    setIsModalOpen(false)
  }

  const directionLabel = (direction) => (direction === 'credit' ? 'Пополнение' : 'Списание')

  return (
    <>
      <PageHeader pretitle="Финансы" title="Баланс и списания" />
      <div className="row row-cards">
      <div className="col-12 card-stack">
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Баланс по аккаунтам</h3>
            <div className="card-actions">
              <button className="btn btn-primary" type="button" onClick={() => setIsModalOpen(true)}>
                Добавить списание
              </button>
            </div>
          </div>
          <div className="table-responsive">
            <table className="table card-table table-vcenter">
              <thead>
                <tr>
                  <th>Аккаунт</th>
                  <th>Режим</th>
                  <th>Баланс</th>
                </tr>
              </thead>
              <tbody>
                {accountBalances.map((account) => (
                  <tr key={account.id}>
                    <td>{account.name}</td>
                    <td>{billingModeLabel(account.billingMode)}</td>
                    <td>
                      <ConvertedAmount
                        amount={account.balance}
                        currency={account.currency}
                        provider={db.providers.find((item) => item.id === account.providerId)}
                        settings={settings}
                        ratesData={ratesData}
                      />
                    </td>
                  </tr>
                ))}
                {accountBalances.length === 0 ? (
                  <EmptyState message="Нет аккаунтов" colSpan={3} />
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Журнал операций</h3>
          </div>
          <div className="table-responsive">
            <table className="table card-table table-vcenter">
              <thead>
                <tr>
                  <th>Дата</th>
                  <th>Тип</th>
                  <th>Направление</th>
                  <th>Аккаунт / VPS</th>
                  <th>Сумма</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {db.balanceLedger.map((row) => {
                  const account = db.providerAccounts.find((item) => item.id === row.providerAccountId)
                  const provider = db.providers.find((item) => item.id === account?.providerId)
                  const vps = db.vps.find((item) => item.id === row.vpsId)
                  return (
                    <tr key={row.id}>
                      <td>{row.date}</td>
                      <td>{paymentTypeLabel(row.type)}</td>
                      <td>
                        <span className={`badge ${row.direction === 'credit' ? 'bg-green-lt' : 'bg-red-lt'}`}>
                          {directionLabel(row.direction)}
                        </span>
                      </td>
                      <td>
                        <div>{account?.name || '-'}</div>
                        <div className="text-secondary">{vps?.dns || vps?.ip || '-'}</div>
                      </td>
                      <td>
                        <ConvertedAmount
                          amount={row.amount}
                          currency={row.currency}
                          provider={provider}
                          settings={settings}
                          ratesData={ratesData}
                        />
                      </td>
                      <td className="text-end">
                        <div className="table-actions">
                          <button
                            className="btn btn-sm btn-outline-danger"
                            type="button"
                            onClick={() => actions.remove('balanceLedger', row.id)}
                          >
                            Удалить
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {db.balanceLedger.length === 0 ? (
                  <EmptyState message="Журнал операций пуст" colSpan={6} />
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

      <UiModal
        open={isModalOpen}
        title="Добавить списание"
        onClose={() => {
          setIsModalOpen(false)
          setError('')
          setForm(emptyForm)
        }}
        size="modal-md"
      >
        <form className="row g-3" onSubmit={onSubmit}>
          <div className="col-12">
            <label className="form-label">Тип списания</label>
            <select
              className="form-select"
              value={form.type}
              onChange={(e) => setForm((prev) => ({ ...prev, type: e.target.value }))}
            >
              <option value="daily_debit">Ежедневное списание</option>
              <option value="monthly_debit">Ежемесячное списание</option>
            </select>
          </div>
          <div className="col-12">
            <label className="form-label">Аккаунт</label>
            <select
              className="form-select"
              value={form.providerAccountId}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, providerAccountId: e.target.value, vpsId: '' }))
              }
            >
              <option value="">Выберите аккаунт</option>
              {db.providerAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </div>
          <div className="col-12">
            <label className="form-label">VPS (необязательно)</label>
            <select
              className="form-select"
              value={form.vpsId}
              onChange={(e) => setForm((prev) => ({ ...prev, vpsId: e.target.value }))}
            >
              <option value="">Без привязки</option>
              {vpsOptions.map((vps) => (
                <option key={vps.id} value={vps.id}>
                  {vps.dns || vps.ip}
                </option>
              ))}
            </select>
          </div>
          <div className="col-12 col-sm-6">
            <label className="form-label">Дата</label>
            <input
              className="form-control"
              type="date"
              value={form.date}
              onChange={(e) => setForm((prev) => ({ ...prev, date: e.target.value }))}
            />
          </div>
          <div className="col-12 col-sm-6">
            <label className="form-label">Валюта</label>
            <select
              className="form-select"
              value={form.currency}
              onChange={(e) => setForm((prev) => ({ ...prev, currency: e.target.value }))}
            >
              <option>USD</option>
              <option>EUR</option>
              <option>RUB</option>
            </select>
          </div>
          <div className="col-12">
            <label className="form-label">Сумма</label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              className="form-control"
              value={form.amount}
              onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))}
            />
          </div>
          <div className="col-12">
            <label className="form-label">Комментарий</label>
            <textarea
              className="form-control"
              value={form.note}
              onChange={(e) => setForm((prev) => ({ ...prev, note: e.target.value }))}
            />
          </div>
          {error ? <div className="col-12 text-danger small">{error}</div> : null}
          <div className="col-12 d-flex gap-2 justify-content-end">
            <button type="button" className="btn btn-outline-secondary" onClick={() => setIsModalOpen(false)}>
              Отмена
            </button>
            <button className="btn btn-primary" type="submit">
              Добавить списание
            </button>
          </div>
        </form>
      </UiModal>
    </>
  )
}
