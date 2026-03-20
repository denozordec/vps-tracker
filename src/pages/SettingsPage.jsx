import { useEffect, useMemo, useState } from 'react'
import { Plus, Send, Trash2 } from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import {
  downloadBackupDatabaseBlob,
  downloadBackupJsonBlob,
  importBackupDatabaseBuffer,
  importBackupJson,
  sendTelegramTestNotification,
} from '../lib/api'
import { downloadBlob } from '../lib/utils'
import { noBrowserSuggestProps, passwordCredentialInputProps } from '../lib/noBrowserSuggestProps'

const defaultSettings = {
  baseCurrency: 'RUB',
  ratesUrl: 'https://www.cbr-xml-daily.ru/latest.js',
  autoConvert: true,
  syncEnabled: false,
  syncIntervalMinutes: 60,
  syncTariffsIntervalMinutes: 1440,
  telegramBotToken: '',
  telegramChatId: '',
  telegramMessageThreadId: '',
  notifyPaymentExpiryEnabled: false,
  notifyNewTariffsEnabled: false,
  notifyLowBalanceEnabled: false,
  notifySyncDigestEnabled: false,
}

export function SettingsPage({ db, actions, ratesData, ratesError }) {
  const current = db.settings?.[0] || defaultSettings
  const [form, setForm] = useState({
    baseCurrency: current.baseCurrency || 'RUB',
    ratesUrl: current.ratesUrl || 'https://www.cbr-xml-daily.ru/latest.js',
    autoConvert: current.autoConvert !== false,
    syncEnabled: current.syncEnabled !== false && Boolean(current.syncEnabled),
    syncIntervalMinutes: current.syncIntervalMinutes ?? 60,
    syncTariffsIntervalMinutes: current.syncTariffsIntervalMinutes ?? 1440,
    telegramBotToken: '',
    telegramChatId: current.telegramChatId ?? '',
    telegramMessageThreadId: current.telegramMessageThreadId ?? '',
    notifyPaymentExpiryEnabled: Boolean(current.notifyPaymentExpiryEnabled),
    notifyNewTariffsEnabled: Boolean(current.notifyNewTariffsEnabled),
    notifyLowBalanceEnabled: Boolean(current.notifyLowBalanceEnabled),
    notifySyncDigestEnabled: Boolean(current.notifySyncDigestEnabled),
  })
  const [telegramTokenEdited, setTelegramTokenEdited] = useState(false)
  const [telegramTestLoading, setTelegramTestLoading] = useState(false)
  const [telegramTestMessage, setTelegramTestMessage] = useState(null)
  const [backupBusy, setBackupBusy] = useState(false)
  const [backupMessage, setBackupMessage] = useState(null)
  const [newFieldLabel, setNewFieldLabel] = useState('')
  const customFields = Array.isArray(current.customFields) ? current.customFields : []

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      baseCurrency: current.baseCurrency || 'RUB',
      ratesUrl: current.ratesUrl || 'https://www.cbr-xml-daily.ru/latest.js',
      autoConvert: current.autoConvert !== false,
      syncEnabled: Boolean(current.syncEnabled),
      syncIntervalMinutes: current.syncIntervalMinutes ?? 60,
      syncTariffsIntervalMinutes: current.syncTariffsIntervalMinutes ?? 1440,
      telegramChatId: current.telegramChatId ?? '',
      telegramMessageThreadId: current.telegramMessageThreadId ?? '',
      notifyPaymentExpiryEnabled: Boolean(current.notifyPaymentExpiryEnabled),
      notifyNewTariffsEnabled: Boolean(current.notifyNewTariffsEnabled),
      notifyLowBalanceEnabled: Boolean(current.notifyLowBalanceEnabled),
      notifySyncDigestEnabled: Boolean(current.notifySyncDigestEnabled),
    }))
  }, [current.baseCurrency, current.ratesUrl, current.autoConvert, current.syncEnabled, current.syncIntervalMinutes, current.syncTariffsIntervalMinutes, current.telegramChatId, current.telegramMessageThreadId, current.notifyPaymentExpiryEnabled, current.notifyNewTariffsEnabled, current.notifyLowBalanceEnabled, current.notifySyncDigestEnabled])

  const availableCurrencies = useMemo(() => {
    const list = new Set(['RUB', 'USD', 'EUR'])
    if (ratesData?.rates) {
      Object.keys(ratesData.rates).forEach((code) => list.add(code))
    }
    return [...list].sort()
  }, [ratesData])

  const onSubmit = (event) => {
    event.preventDefault()
    actions.upsertSettings({
      baseCurrency: form.baseCurrency,
      ratesUrl: form.ratesUrl,
      autoConvert: form.autoConvert,
      ratesUpdatedAt: ratesData?.date || '',
    })
  }

  const onSyncSettingsSubmit = (event) => {
    event.preventDefault()
    actions.upsertSettings({
      syncEnabled: form.syncEnabled,
      syncIntervalMinutes: Math.max(15, Number(form.syncIntervalMinutes) || 60),
      syncTariffsIntervalMinutes: Math.max(60, Number(form.syncTariffsIntervalMinutes) || 1440),
    })
  }

  const onTelegramTest = async () => {
    setTelegramTestMessage(null)
    setTelegramTestLoading(true)
    try {
      await sendTelegramTestNotification()
      setTelegramTestMessage({ type: 'success', text: 'Тестовое уведомление отправлено' })
    } catch (err) {
      setTelegramTestMessage({ type: 'danger', text: err.message || 'Ошибка отправки' })
    } finally {
      setTelegramTestLoading(false)
    }
  }

  const onTelegramSubmit = (event) => {
    event.preventDefault()
    const payload = {
      telegramChatId: form.telegramChatId || '',
      telegramMessageThreadId: form.telegramMessageThreadId || '',
      notifyPaymentExpiryEnabled: form.notifyPaymentExpiryEnabled,
      notifyNewTariffsEnabled: form.notifyNewTariffsEnabled,
      notifyLowBalanceEnabled: form.notifyLowBalanceEnabled,
      notifySyncDigestEnabled: form.notifySyncDigestEnabled,
    }
    if (telegramTokenEdited && form.telegramBotToken !== undefined) {
      payload.telegramBotToken = form.telegramBotToken || ''
    }
    actions.upsertSettings(payload)
    setTelegramTokenEdited(false)
    setForm((prev) => ({ ...prev, telegramBotToken: '' }))
  }

  const addCustomField = () => {
    const label = newFieldLabel.trim()
    if (!label) return
    const nextIndex = customFields.reduce((max, f) => {
      const n = parseInt(f.key?.replace('cf_', '') || '0', 10)
      return Math.max(max, n)
    }, -1) + 1
    const key = `cf_${nextIndex}`
    actions.upsertSettings({ customFields: [...customFields, { key, label }] })
    setNewFieldLabel('')
  }

  const removeCustomField = (key) => {
    actions.upsertSettings({
      customFields: customFields.filter((f) => f.key !== key),
    })
  }

  return (
    <>
      <PageHeader pretitle="Система" title="Настройки" />
      <div className="row row-cards">
      <div className="col-12">
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Настройки валют</h3>
          </div>
          <div className="card-body">
            <form className="row g-3" autoComplete="off" onSubmit={onSubmit}>
              <div className="col-12 col-md-6">
                <label className="form-label">Валюта отображения</label>
                <select autoComplete="off"
                  className="form-select"
                  value={form.baseCurrency}
                  onChange={(e) => setForm((prev) => ({ ...prev, baseCurrency: e.target.value }))}
                >
                  {availableCurrencies.map((code) => (
                    <option key={code} value={code}>
                      {code}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-12 col-md-6">
                <label className="form-label">Автоконвертация</label>
                <label className="form-check">
                  <input {...noBrowserSuggestProps}
                    className="form-check-input"
                    type="checkbox"
                    checked={form.autoConvert}
                    onChange={(e) => setForm((prev) => ({ ...prev, autoConvert: e.target.checked }))}
                  />
                  <span className="form-check-label">Показывать суммы в валюте отображения</span>
                </label>
              </div>
              <div className="col-12">
                <label className="form-label">Ссылка на курсы валют</label>
                <input {...noBrowserSuggestProps}
                  className="form-control"
                  value={form.ratesUrl}
                  onChange={(e) => setForm((prev) => ({ ...prev, ratesUrl: e.target.value }))}
                  placeholder="https://www.cbr-xml-daily.ru/latest.js"
                />
              </div>
              <div className="col-12 d-flex justify-content-end">
                <button type="submit" className="btn btn-primary">
                  Сохранить настройки
                </button>
              </div>
              <div className="col-12">
                <div className="text-secondary small">
                  Валюта отображения — в какой валюте показывать суммы на дашбордах. Курсы хостера (если указаны)
                  имеют приоритет над глобальными курсами по ссылке выше.
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>

      <div className="col-12 col-lg-6">
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Дополнительные поля VPS</h3>
          </div>
          <div className="card-body">
            <p className="text-secondary small mb-3">
              Текстовые поля для расширенного режима просмотра списка VPS. Отображаются как колонки в таблице и в форме редактирования.
            </p>
            <div className="d-flex gap-2 mb-3">
              <input {...noBrowserSuggestProps}
                type="text"
                className="form-control"
                placeholder="Название поля (например: Контакт, ID заказа)"
                value={newFieldLabel}
                onChange={(e) => setNewFieldLabel(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCustomField())}
              />
              <button
                type="button"
                className="btn btn-primary"
                onClick={addCustomField}
              >
                <Plus size={16} />
              </button>
            </div>
            {customFields.length > 0 ? (
              <ul className="list-group list-group-flush">
                {customFields.map((f) => (
                  <li key={f.key} className="list-group-item d-flex justify-content-between align-items-center">
                    <span>{f.label}</span>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-danger"
                      onClick={() => removeCustomField(f.key)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-secondary small">Нет дополнительных полей</div>
            )}
          </div>
        </div>
      </div>

      <div className="col-12 col-lg-6">
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Синхронизация с API хостеров</h3>
          </div>
          <div className="card-body">
            <p className="text-secondary small mb-3">
              Периодическая синхронизация данных из BILLmanager для аккаунтов с настроенным API.
              Два независимых интервала: VPS и платежи обновляются чаще, тарифы — реже.
            </p>
            <form className="row g-3" autoComplete="off" onSubmit={onSyncSettingsSubmit}>
              <div className="col-12">
                <label className="form-check">
                  <input {...noBrowserSuggestProps}
                    className="form-check-input"
                    type="checkbox"
                    checked={form.syncEnabled}
                    onChange={(e) => setForm((prev) => ({ ...prev, syncEnabled: e.target.checked }))}
                  />
                  <span className="form-check-label">Включить периодическую синхронизацию</span>
                </label>
              </div>
              <div className="col-12 col-md-6">
                <label className="form-label">Интервал VPS и платежей (минуты)</label>
                <input {...noBrowserSuggestProps}
                  type="number"
                  min="15"
                  className="form-control"
                  value={form.syncIntervalMinutes}
                  onChange={(e) => setForm((prev) => ({ ...prev, syncIntervalMinutes: e.target.value }))}
                  placeholder="60"
                />
              </div>
              <div className="col-12 col-md-6">
                <label className="form-label">Интервал тарифов (минуты)</label>
                <input {...noBrowserSuggestProps}
                  type="number"
                  min="60"
                  className="form-control"
                  value={form.syncTariffsIntervalMinutes}
                  onChange={(e) => setForm((prev) => ({ ...prev, syncTariffsIntervalMinutes: e.target.value }))}
                  placeholder="1440"
                />
                <div className="text-secondary small mt-1">
                  Тарифы меняются редко, можно ставить 24 ч (1440) и больше
                </div>
              </div>
              <div className="col-12 d-flex justify-content-end">
                <button type="submit" className="btn btn-primary">
                  Сохранить
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <div className="col-12 col-lg-6">
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Уведомления Telegram</h3>
          </div>
          <div className="card-body">
            <p className="text-secondary small mb-3">
              Уведомления отправляются в Telegram при периодической синхронизации. Каждый тип можно включить или отключить отдельно.
            </p>
            <form className="row g-3" autoComplete="off" onSubmit={onTelegramSubmit}>
              <div className="col-12">
                <label className="form-label">Токен бота</label>
                <input {...passwordCredentialInputProps}
                  type="password"
                  className="form-control"
                  value={form.telegramBotToken}
                  onChange={(e) => {
                    setForm((prev) => ({ ...prev, telegramBotToken: e.target.value }))
                    setTelegramTokenEdited(true)
                  }}
                  placeholder={current.telegramBotTokenSet ? '••••••••' : 'Токен от @BotFather'}
                />
              </div>
              <div className="col-12">
                <label className="form-label">Chat ID (SuperGroup)</label>
                <input {...noBrowserSuggestProps}
                  type="text"
                  className="form-control"
                  value={form.telegramChatId}
                  onChange={(e) => setForm((prev) => ({ ...prev, telegramChatId: e.target.value }))}
                  placeholder="например -1001234567890"
                />
                <div className="text-secondary small mt-1">
                  ID группы (отрицательное число). Добавьте бота в группу, затем getUpdates — chat.id.
                </div>
              </div>
              <div className="col-12">
                <label className="form-label">ID топика (цепочки сообщений)</label>
                <input {...noBrowserSuggestProps}
                  type="text"
                  className="form-control"
                  value={form.telegramMessageThreadId}
                  onChange={(e) => setForm((prev) => ({ ...prev, telegramMessageThreadId: e.target.value }))}
                  placeholder="необязательно, например 12345"
                />
                <div className="text-secondary small mt-1">
                  Для SuperGroup с топиками — ID топика. Оставьте пустым для общей ленты группы.
                </div>
              </div>
              <div className="col-12">
                <label className="form-check">
                  <input {...noBrowserSuggestProps}
                    className="form-check-input"
                    type="checkbox"
                    checked={form.notifyPaymentExpiryEnabled}
                    onChange={(e) => setForm((prev) => ({ ...prev, notifyPaymentExpiryEnabled: e.target.checked }))}
                  />
                  <span className="form-check-label">Уведомления об истекающей оплате (ближайшие 7 дней)</span>
                </label>
              </div>
              <div className="col-12">
                <label className="form-check">
                  <input {...noBrowserSuggestProps}
                    className="form-check-input"
                    type="checkbox"
                    checked={form.notifyNewTariffsEnabled}
                    onChange={(e) => setForm((prev) => ({ ...prev, notifyNewTariffsEnabled: e.target.checked }))}
                  />
                  <span className="form-check-label">Уведомления о новых тарифах</span>
                </label>
              </div>
              <div className="col-12">
                <label className="form-check">
                  <input {...noBrowserSuggestProps}
                    className="form-check-input"
                    type="checkbox"
                    checked={form.notifyLowBalanceEnabled}
                    onChange={(e) => setForm((prev) => ({ ...prev, notifyLowBalanceEnabled: e.target.checked }))}
                  />
                  <span className="form-check-label">
                    Низкий баланс (порог задаётся у каждого аккаунта BILLmanager)
                  </span>
                </label>
              </div>
              <div className="col-12">
                <label className="form-check">
                  <input {...noBrowserSuggestProps}
                    className="form-check-input"
                    type="checkbox"
                    checked={form.notifySyncDigestEnabled}
                    onChange={(e) => setForm((prev) => ({ ...prev, notifySyncDigestEnabled: e.target.checked }))}
                  />
                  <span className="form-check-label">Краткий итог после планового синка VPS</span>
                </label>
              </div>
              <div className="col-12 d-flex justify-content-end gap-2">
                <button
                  type="button"
                  className="btn btn-outline-primary"
                  onClick={onTelegramTest}
                  disabled={telegramTestLoading || !current.telegramBotTokenSet || !current.telegramChatId}
                >
                  {telegramTestLoading ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-1" />
                      Отправка…
                    </>
                  ) : (
                    <>
                      <Send size={16} className="me-1" />
                      Тестовое уведомление
                    </>
                  )}
                </button>
                <button type="submit" className="btn btn-primary">
                  Сохранить
                </button>
              </div>
              {telegramTestMessage ? (
                <div className={`col-12 alert alert-${telegramTestMessage.type} py-2 mb-0`}>
                  {telegramTestMessage.text}
                </div>
              ) : null}
            </form>
          </div>
        </div>
      </div>

      <div className="col-12">
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Резервная копия</h3>
          </div>
          <div className="card-body">
            <p className="text-secondary small mb-3">
              JSON включает все данные (в т.ч. API-ключи и токен Telegram). Файл SQLite — точная копия базы.
              Восстановление перезаписывает текущие данные.
            </p>
            <div className="d-flex flex-wrap gap-2 mb-3">
              <button
                type="button"
                className="btn btn-outline-primary"
                disabled={backupBusy}
                onClick={async () => {
                  setBackupMessage(null)
                  setBackupBusy(true)
                  try {
                    const blob = await downloadBackupJsonBlob()
                    downloadBlob('vps-tracker-backup.json', blob)
                  } catch (err) {
                    setBackupMessage({ type: 'danger', text: err.message || 'Ошибка выгрузки' })
                  } finally {
                    setBackupBusy(false)
                  }
                }}
              >
                Скачать JSON
              </button>
              <button
                type="button"
                className="btn btn-outline-primary"
                disabled={backupBusy}
                onClick={async () => {
                  setBackupMessage(null)
                  setBackupBusy(true)
                  try {
                    const blob = await downloadBackupDatabaseBlob()
                    downloadBlob('vps-tracker.db', blob)
                  } catch (err) {
                    setBackupMessage({ type: 'danger', text: err.message || 'Ошибка выгрузки' })
                  } finally {
                    setBackupBusy(false)
                  }
                }}
              >
                Скачать SQLite
              </button>
            </div>
            <div className="row g-2 align-items-end">
              <div className="col-12 col-md-6">
                <label className="form-label">Восстановить из JSON</label>
                <input
                  {...noBrowserSuggestProps}
                  type="file"
                  accept="application/json,.json"
                  className="form-control"
                  disabled={backupBusy}
                  onChange={async (e) => {
                    const file = e.target.files?.[0]
                    e.target.value = ''
                    if (!file) return
                    setBackupMessage(null)
                    setBackupBusy(true)
                    try {
                      const text = await file.text()
                      const data = JSON.parse(text)
                      await importBackupJson(data)
                      await actions.refreshData()
                      setBackupMessage({ type: 'success', text: 'Данные восстановлены из JSON' })
                    } catch (err) {
                      setBackupMessage({ type: 'danger', text: err.message || 'Ошибка импорта' })
                    } finally {
                      setBackupBusy(false)
                    }
                  }}
                />
              </div>
              <div className="col-12 col-md-6">
                <label className="form-label">Восстановить из SQLite</label>
                <input
                  {...noBrowserSuggestProps}
                  type="file"
                  accept=".db,application/octet-stream"
                  className="form-control"
                  disabled={backupBusy}
                  onChange={async (e) => {
                    const file = e.target.files?.[0]
                    e.target.value = ''
                    if (!file) return
                    setBackupMessage(null)
                    setBackupBusy(true)
                    try {
                      const buf = await file.arrayBuffer()
                      await importBackupDatabaseBuffer(buf)
                      await actions.refreshData()
                      setBackupMessage({ type: 'success', text: 'База восстановлена из SQLite' })
                    } catch (err) {
                      setBackupMessage({ type: 'danger', text: err.message || 'Ошибка восстановления' })
                    } finally {
                      setBackupBusy(false)
                    }
                  }}
                />
              </div>
            </div>
            {backupMessage ? (
              <div className={`alert alert-${backupMessage.type} py-2 mt-3 mb-0`}>{backupMessage.text}</div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="col-12 col-lg-6">
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Статус источника курсов</h3>
          </div>
          <div className="card-body">
            <div className="mb-2">
              <span className="text-secondary">Источник:</span> {current.ratesUrl}
            </div>
            <div className="mb-2">
              <span className="text-secondary">Дата курсов:</span> {ratesData?.date || '-'}
            </div>
            <div className="mb-2">
              <span className="text-secondary">База API:</span> {ratesData?.base || '-'}
            </div>
            <button
              type="button"
              className="btn btn-outline-primary btn-sm mb-3"
              onClick={() => actions.upsertSettings({ ratesUpdatedAt: new Date().toISOString() })}
            >
              Обновить курсы сейчас
            </button>
            {ratesError ? <div className="alert alert-danger py-2">{ratesError}</div> : null}
            {!ratesError && ratesData ? (
              <div className="alert alert-success py-2 mb-0">
                Курсы загружены. Текущая конвертация работает автоматически.
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
    </>
  )
}
