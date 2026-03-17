import { useMemo, useState } from 'react'
import { paymentTypeLabel } from '../lib/utils'
import { UiModal } from '../components/UiModal'
import { EmptyState } from '../components/EmptyState'
import { PageHeader } from '../components/PageHeader'
import { ConvertedAmount } from '../components/ConvertedAmount'

const emptyForm = {
  type: 'direct_vps_payment',
  date: new Date().toISOString().slice(0, 10),
  amount: '',
  currency: 'USD',
  providerAccountId: '',
  vpsId: '',
  note: '',
}

export function PaymentsPage({ db, actions, settings, ratesData }) {
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)

  const vpsOptions = useMemo(
    () => db.vps.filter((item) => !form.providerAccountId || item.providerAccountId === form.providerAccountId),
    [db.vps, form.providerAccountId],
  )

  const onSubmit = (event) => {
    event.preventDefault()
    const amount = Number(form.amount)
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Сумма должна быть больше 0')
      return
    }
    if (!form.providerAccountId) {
      setError('Выберите аккаунт хостера')
      return
    }
    if (form.type === 'direct_vps_payment' && !form.vpsId) {
      setError('Для прямого платежа выберите VPS')
      return
    }
    setError('')

    actions.create('payments', {
      type: form.type,
      date: form.date,
      amount,
      currency: form.currency,
      providerAccountId: form.providerAccountId,
      vpsId: form.vpsId || '',
      note: form.note,
    })

    if (form.type === 'provider_balance_topup') {
      actions.create('balanceLedger', {
        type: 'provider_balance_topup',
        date: form.date,
        amount,
        currency: form.currency,
        direction: 'credit',
        providerAccountId: form.providerAccountId,
        vpsId: '',
        note: form.note || 'Пополнение баланса',
      })
    }

    setForm(emptyForm)
    setIsModalOpen(false)
  }

  return (
    <>
      <PageHeader pretitle="Финансы" title="Платежи" />
      <div className="row row-cards">
      <div className="col-12">
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">История платежей</h3>
            <div className="card-actions">
              <button type="button" className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
                Добавить платеж
              </button>
            </div>
          </div>
          <div className="table-responsive">
            <table className="table card-table table-vcenter">
              <thead>
                <tr>
                  <th>Дата</th>
                  <th>Тип</th>
                  <th>Аккаунт / VPS</th>
                  <th>Сумма</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {db.payments.map((payment) => {
                  const account = db.providerAccounts.find((item) => item.id === payment.providerAccountId)
                  const provider = db.providers.find((item) => item.id === account?.providerId)
                  const vps = db.vps.find((item) => item.id === payment.vpsId)
                  return (
                    <tr key={payment.id}>
                      <td>{payment.date}</td>
                      <td>{paymentTypeLabel(payment.type)}</td>
                      <td>
                        <div>{account?.name || '-'}</div>
                        <div className="text-secondary">{vps?.dns || vps?.ip || '-'}</div>
                      </td>
                      <td>
                        <ConvertedAmount
                          amount={payment.amount}
                          currency={payment.currency}
                          provider={provider}
                          settings={settings}
                          ratesData={ratesData}
                        />
                      </td>
                      <td className="text-end">
                        <div className="table-actions">
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger"
                            onClick={() => actions.remove('payments', payment.id)}
                          >
                            Удалить
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {db.payments.length === 0 ? (
                  <EmptyState message="Нет платежей" colSpan={5} />
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

      <UiModal
        open={isModalOpen}
        title="Новая операция платежа"
        onClose={() => {
          setIsModalOpen(false)
          setError('')
          setForm(emptyForm)
        }}
        size="modal-md"
      >
        <form className="row g-3" onSubmit={onSubmit}>
          <div className="col-12">
            <label className="form-label">Тип</label>
            <select
              className="form-select"
              value={form.type}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  type: e.target.value,
                  vpsId: '',
                }))
              }
            >
              <option value="direct_vps_payment">Прямой платеж за VPS</option>
              <option value="provider_balance_topup">Пополнение баланса хостера</option>
            </select>
          </div>
          <div className="col-12">
            <label className="form-label">Аккаунт хостера</label>
            <select
              className="form-select"
              value={form.providerAccountId}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  providerAccountId: e.target.value,
                  vpsId: '',
                }))
              }
              required
            >
              <option value="">Выберите аккаунт</option>
              {db.providerAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </div>
          {form.type === 'direct_vps_payment' ? (
            <div className="col-12">
              <label className="form-label">VPS</label>
              <select
                className="form-select"
                value={form.vpsId}
                onChange={(e) => setForm((prev) => ({ ...prev, vpsId: e.target.value }))}
                required
              >
                <option value="">Выберите VPS</option>
                {vpsOptions.map((vps) => (
                  <option key={vps.id} value={vps.id}>
                    {vps.dns || vps.ip}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <div className="col-12 col-sm-6">
            <label className="form-label">Дата</label>
            <input
              type="date"
              className="form-control"
              value={form.date}
              onChange={(e) => setForm((prev) => ({ ...prev, date: e.target.value }))}
              required
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
              step="0.01"
              min="0.01"
              className="form-control"
              value={form.amount}
              onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))}
              required
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
            <button type="submit" className="btn btn-primary">
              Сохранить
            </button>
          </div>
        </form>
      </UiModal>
    </>
  )
}
