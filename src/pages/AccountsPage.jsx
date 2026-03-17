import { useEffect, useMemo, useState } from 'react'
import {
  billingModeLabel,
  faviconUrlFromWebsite,
} from '../lib/utils'
import { UiModal } from '../components/UiModal'
import { EmptyState } from '../components/EmptyState'
import { SyncLogTable } from '../components/SyncLogTable'
import { PageHeader } from '../components/PageHeader'
import { ConvertedAmount } from '../components/ConvertedAmount'
import { syncAccount, testApiConnection, fetchAccountBalance, fetchSyncStatus } from '../lib/api'
import { IconRefresh, IconPlugConnected } from '@tabler/icons-react'

const emptyForm = {
  providerId: '',
  name: '',
  panelUrl: '',
  currency: 'USD',
  billingMode: 'monthly',
  notes: '',
  apiType: '',
  apiBaseUrl: '',
  apiLogin: '',
  apiPassword: '',
}

export function AccountsPage({ db, actions, settings, ratesData }) {
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [syncLoadingId, setSyncLoadingId] = useState(null)
  const [syncLoadingAll, setSyncLoadingAll] = useState(false)
  const [syncMessage, setSyncMessage] = useState(null)
  const [balanceLoadingId, setBalanceLoadingId] = useState(null)
  const [saveError, setSaveError] = useState(null)

  const loadSyncLog = () => {
    fetchSyncStatus()
      .then(setSyncLog)
      .catch(() => setSyncLog([]))
  }

  useEffect(() => {
    loadSyncLog()
  }, [])

  const billmanagerAccounts = useMemo(
    () => db.providerAccounts.filter((a) => a.apiType === 'billmanager' && a.apiBaseUrl),
    [db.providerAccounts],
  )
  const [testConnectionLoading, setTestConnectionLoading] = useState(false)
  const [testConnectionResult, setTestConnectionResult] = useState(null)
  const [syncLog, setSyncLog] = useState([])

  const balances = useMemo(() => {
    return db.providerAccounts.map((account) => {
      const rows = db.balanceLedger.filter((row) => row.providerAccountId === account.id)
      const credits = rows
        .filter((row) => row.direction === 'credit')
        .reduce((acc, row) => acc + Number(row.amount || 0), 0)
      const debits = rows
        .filter((row) => row.direction === 'debit')
        .reduce((acc, row) => acc + Number(row.amount || 0), 0)
      return { accountId: account.id, balance: credits - debits }
    })
  }, [db.balanceLedger, db.providerAccounts])

  const getBalance = (accountId) => balances.find((item) => item.accountId === accountId)?.balance || 0

  const getDisplayBalance = (account) => {
    if (account.apiType === 'billmanager' && account.balance_api != null) {
      return account.balance_api
    }
    return getBalance(account.id)
  }

  const getDisplayCurrency = (account) => account.balance_currency || account.currency || 'USD'

  const onFetchBalance = async (accountId) => {
    setBalanceLoadingId(accountId)
    try {
      await fetchAccountBalance(accountId)
      await actions.refreshData()
    } catch (err) {
      console.error('Balance fetch failed:', err)
    } finally {
      setBalanceLoadingId(null)
    }
  }

  const onSubmit = async (event) => {
    event.preventDefault()
    if (!form.providerId || !form.name.trim()) {
      return
    }
    const payload = {
      providerId: form.providerId,
      name: form.name,
      panelUrl: form.panelUrl,
      currency: form.currency,
      billingMode: form.billingMode,
      notes: form.notes,
      apiType: form.apiType || '',
      apiBaseUrl: form.apiType === 'billmanager' ? form.apiBaseUrl : '',
    }
    if (form.apiType === 'billmanager' && form.apiLogin && form.apiPassword) {
      payload.apiCredentials = `${form.apiLogin}:${form.apiPassword}`
    }
    setSaveError(null)
    try {
      if (editingId) {
        await actions.update('providerAccounts', editingId, payload)
      } else {
        await actions.create('providerAccounts', payload)
      }
      setForm(emptyForm)
      setEditingId(null)
      setIsModalOpen(false)
    } catch (err) {
      setSaveError(err.message || 'Ошибка сохранения')
    }
  }

  const onTestConnection = async () => {
    if (!form.apiBaseUrl?.trim() || !form.apiLogin?.trim() || !form.apiPassword?.trim()) {
      setTestConnectionResult({ ok: false, error: 'Заполните URL, логин и пароль' })
      return
    }
    setTestConnectionLoading(true)
    setTestConnectionResult(null)
    try {
      const result = await testApiConnection(form.apiBaseUrl, `${form.apiLogin}:${form.apiPassword}`)
      setTestConnectionResult(result)
    } catch (err) {
      setTestConnectionResult({ ok: false, error: err.message || 'Ошибка проверки' })
    } finally {
      setTestConnectionLoading(false)
    }
  }

  const onEdit = (account) => {
    setForm({
      providerId: account.providerId || '',
      name: account.name || '',
      panelUrl: account.panelUrl || '',
      currency: account.currency || 'USD',
      billingMode: account.billingMode || 'monthly',
      notes: account.notes || '',
      apiType: account.apiType || '',
      apiBaseUrl: account.apiBaseUrl || '',
      apiLogin: '',
      apiPassword: '',
    })
    setEditingId(account.id)
    setIsModalOpen(true)
    setTestConnectionResult(null)
  }

  const editingAccount = editingId ? db.providerAccounts.find((a) => a.id === editingId) : null
  const canTestConnection = form.apiType === 'billmanager' && form.apiBaseUrl?.trim() && form.apiLogin?.trim() && form.apiPassword?.trim()

  const onSync = async (accountId) => {
    setSyncLoadingId(accountId)
    setSyncMessage(null)
    try {
      const result = await syncAccount(accountId)
      setSyncMessage(result.ok ? `Синхронизировано: ${result.synced?.vpsCount ?? 0} VPS, ${result.synced?.paymentsCount ?? 0} платежей${result.synced?.balance ? ', баланс обновлён' : ''}` : result.error || 'Ошибка')
      if (result.ok) {
        await actions.refreshData()
        loadSyncLog()
      }
    } catch (err) {
      setSyncMessage(err.message || 'Ошибка синхронизации')
    } finally {
      setSyncLoadingId(null)
    }
  }

  const onSyncAll = async () => {
    if (billmanagerAccounts.length === 0) return
    setSyncLoadingAll(true)
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
      setSyncMessage(`Синхронизировано: ${totalVps} VPS, ${totalPayments} платежей${lastError ? `. Ошибки: ${lastError}` : ''}`)
    }
    if (totalVps > 0 || totalPayments > 0) {
      await actions.refreshData()
      loadSyncLog()
    }
    setSyncLoadingAll(false)
  }

  return (
    <>
      <PageHeader pretitle="Справочники" title="Аккаунты хостеров" />
      <div className="row row-cards">
      <div className="col-12">
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Аккаунты и привязанные VPS</h3>
            {syncMessage ? (
              <div className={`alert alert-${syncMessage.startsWith('Синхронизировано') ? 'success' : 'warning'} py-2 mb-0 me-2`}>
                {syncMessage}
              </div>
            ) : null}
            <div className="card-actions d-flex gap-2">
              {billmanagerAccounts.length > 0 ? (
                <button
                  type="button"
                  className="btn btn-outline-primary"
                  onClick={onSyncAll}
                  disabled={syncLoadingAll}
                  title="Синхронизировать VPS и платежи со всех BILLmanager аккаунтов"
                >
                  {syncLoadingAll ? (
                    <span className="spinner-border spinner-border-sm me-1" role="status" />
                  ) : (
                    <IconRefresh size={16} className="me-1" />
                  )}
                  Синхронизировать VPS
                </button>
              ) : null}
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  setForm(emptyForm)
                  setEditingId(null)
                  setIsModalOpen(true)
                }}
              >
                Добавить аккаунт
              </button>
            </div>
          </div>
          <div className="table-responsive">
            <table className="table card-table table-vcenter">
              <thead>
                <tr>
                  <th>Аккаунт</th>
                  <th>Хостер</th>
                  <th>VPS</th>
                  <th>Баланс</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {db.providerAccounts.map((account) => {
                  const provider = db.providers.find((item) => item.id === account.providerId)
                  const linkedVps = db.vps.filter((item) => item.providerAccountId === account.id)
                  return (
                    <tr key={account.id}>
                      <td>{account.name}</td>
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
                      </td>
                      <td>{linkedVps.map((item) => item.dns || item.ip).join(', ') || '-'}</td>
                      <td>
                        <ConvertedAmount
                          amount={getDisplayBalance(account)}
                          currency={getDisplayCurrency(account)}
                          provider={provider}
                          settings={settings}
                          ratesData={ratesData}
                        />
                        {account.balance_updated_at ? (
                          <div className="text-secondary small mt-1">
                            Обновлено: {new Date(account.balance_updated_at).toLocaleString('ru-RU')}
                          </div>
                        ) : null}
                        {account.enoughmoneyto ? (
                          <div className="text-secondary small mt-1">
                            Хватит до: {account.enoughmoneyto}
                          </div>
                        ) : null}
                      </td>
                      <td className="text-end">
                        <div className="table-actions d-flex gap-1 flex-wrap justify-content-end">
                          {account.apiType === 'billmanager' && account.apiBaseUrl ? (
                            <>
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-secondary"
                                onClick={() => onFetchBalance(account.id)}
                                disabled={balanceLoadingId === account.id}
                                title="Обновить баланс из API"
                              >
                                {balanceLoadingId === account.id ? (
                                  <span className="spinner-border spinner-border-sm me-1" role="status" />
                                ) : (
                                  <IconRefresh size={14} className="me-1" />
                                )}
                                Баланс
                              </button>
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-secondary"
                                onClick={() => onSync(account.id)}
                                disabled={syncLoadingId === account.id}
                                title="Синхронизировать VPS и платежи с BILLmanager"
                              >
                                {syncLoadingId === account.id ? (
                                  <span className="spinner-border spinner-border-sm me-1" role="status" />
                                ) : (
                                  <IconRefresh size={14} className="me-1" />
                                )}
                                Синхронизировать
                              </button>
                            </>
                          ) : null}
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-primary"
                            onClick={() => onEdit(account)}
                          >
                            Изменить
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger"
                            onClick={() => actions.remove('providerAccounts', account.id)}
                          >
                            Удалить
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {db.providerAccounts.length === 0 ? (
                  <EmptyState message="Нет аккаунтов хостеров" colSpan={5} />
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="col-12 mt-3">
        <SyncLogTable syncLog={syncLog} providerAccounts={db.providerAccounts} />
      </div>
    </div>

      <UiModal
        open={isModalOpen}
        title={editingId ? 'Редактировать аккаунт' : 'Новый аккаунт хостера'}
        onClose={() => {
          setIsModalOpen(false)
          setEditingId(null)
          setForm(emptyForm)
          setTestConnectionResult(null)
          setSaveError(null)
        }}
        size="modal-md"
      >
        <form onSubmit={onSubmit} className="row g-3">
          <div className="col-12">
            <label className="form-label">Хостер</label>
            <select
              className="form-select"
              value={form.providerId}
              onChange={(e) => setForm((prev) => ({ ...prev, providerId: e.target.value }))}
              required
            >
              <option value="">Выберите хостера</option>
              {db.providers.map((provider) => (
                <option key={provider.id} value={provider.id}>
                  {provider.name}
                </option>
              ))}
            </select>
          </div>
          <div className="col-12">
            <label className="form-label">Имя / Псевдоним аккаунта</label>
            <input
              className="form-control"
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              required
            />
          </div>
          <div className="col-12">
            <label className="form-label">Ссылка на панель управления</label>
            <input
              className="form-control"
              placeholder="https://..."
              value={form.panelUrl}
              onChange={(e) => setForm((prev) => ({ ...prev, panelUrl: e.target.value }))}
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
          <div className="col-12 col-sm-6">
            <label className="form-label">Режим списания</label>
            <select
              className="form-select"
              value={form.billingMode}
              onChange={(e) => setForm((prev) => ({ ...prev, billingMode: e.target.value }))}
            >
              <option value="daily">{billingModeLabel('daily')}</option>
              <option value="monthly">{billingModeLabel('monthly')}</option>
            </select>
          </div>
          <div className="col-12">
            <hr className="my-2" />
            <h6 className="text-secondary mb-2">Интеграция API</h6>
          </div>
          <div className="col-12">
            <label className="form-label">Тип API</label>
            <select
              className="form-select"
              value={form.apiType}
              onChange={(e) => setForm((prev) => ({ ...prev, apiType: e.target.value, apiBaseUrl: '', apiLogin: '', apiPassword: '' }))}
            >
              <option value="">— Не использовать —</option>
              <option value="billmanager">BILLmanager</option>
            </select>
          </div>
          {form.apiType === 'billmanager' ? (
            <>
              <div className="col-12">
                <label className="form-label">URL API BILLmanager</label>
                <input
                  className="form-control"
                  placeholder="https://bill.example.com:1500/billmgr"
                  value={form.apiBaseUrl}
                  onChange={(e) => setForm((prev) => ({ ...prev, apiBaseUrl: e.target.value }))}
                />
              </div>
              <div className="col-12 col-sm-6">
                <label className="form-label">Логин</label>
                <input
                  className="form-control"
                  placeholder="admin"
                  value={form.apiLogin}
                  onChange={(e) => setForm((prev) => ({ ...prev, apiLogin: e.target.value }))}
                />
              </div>
              <div className="col-12 col-sm-6">
                <label className="form-label">Пароль</label>
                <input
                  type="password"
                  className="form-control"
                  placeholder={editingAccount?.apiCredentialsSet ? 'Оставьте пустым, чтобы не менять' : ''}
                  value={form.apiPassword}
                  onChange={(e) => setForm((prev) => ({ ...prev, apiPassword: e.target.value }))}
                />
              </div>
              <div className="col-12 d-flex align-items-center gap-2">
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm"
                  onClick={onTestConnection}
                  disabled={!canTestConnection || testConnectionLoading}
                >
                  {testConnectionLoading ? (
                    <span className="spinner-border spinner-border-sm me-1" role="status" />
                  ) : (
                    <IconPlugConnected size={14} className="me-1" />
                  )}
                  Проверить соединение
                </button>
                {testConnectionResult ? (
                  <span className={testConnectionResult.ok ? 'text-success small' : 'text-danger small'}>
                    {testConnectionResult.ok
                      ? `Соединение успешно${testConnectionResult.vdsCount != null ? `, VDS: ${testConnectionResult.vdsCount}` : ''}`
                      : testConnectionResult.error}
                  </span>
                ) : null}
              </div>
            </>
          ) : null}
          <div className="col-12">
            <label className="form-label">Комментарий</label>
            <textarea
              className="form-control"
              value={form.notes}
              onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
            />
          </div>
          {saveError ? (
            <div className="col-12">
              <div className="alert alert-danger py-2">{saveError}</div>
            </div>
          ) : null}
          <div className="col-12 d-flex gap-2 justify-content-end">
            <button type="button" className="btn btn-outline-secondary" onClick={() => setIsModalOpen(false)}>
              Отмена
            </button>
            <button type="submit" className="btn btn-primary">
              {editingId ? 'Сохранить' : 'Добавить'}
            </button>
          </div>
        </form>
      </UiModal>
    </>
  )
}
