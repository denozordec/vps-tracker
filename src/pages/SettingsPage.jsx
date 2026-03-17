import { useEffect, useMemo, useState } from 'react'
import { IconPlus, IconTrash } from '@tabler/icons-react'
import { PageHeader } from '../components/PageHeader'

const defaultSettings = {
  baseCurrency: 'RUB',
  ratesUrl: 'https://www.cbr-xml-daily.ru/latest.js',
  autoConvert: true,
  syncEnabled: false,
  syncIntervalMinutes: 60,
}

export function SettingsPage({ db, actions, ratesData, ratesError }) {
  const current = db.settings?.[0] || defaultSettings
  const [form, setForm] = useState({
    baseCurrency: current.baseCurrency || 'RUB',
    ratesUrl: current.ratesUrl || 'https://www.cbr-xml-daily.ru/latest.js',
    autoConvert: current.autoConvert !== false,
    syncEnabled: current.syncEnabled !== false && Boolean(current.syncEnabled),
    syncIntervalMinutes: current.syncIntervalMinutes ?? 60,
  })
  const [newFieldLabel, setNewFieldLabel] = useState('')
  const customFields = Array.isArray(current.customFields) ? current.customFields : []

  useEffect(() => {
    /* eslint-disable-next-line react-hooks/set-state-in-effect -- sync form when settings change from parent */
    setForm({
      baseCurrency: current.baseCurrency || 'RUB',
      ratesUrl: current.ratesUrl || 'https://www.cbr-xml-daily.ru/latest.js',
      autoConvert: current.autoConvert !== false,
      syncEnabled: Boolean(current.syncEnabled),
      syncIntervalMinutes: current.syncIntervalMinutes ?? 60,
    })
  }, [current.baseCurrency, current.ratesUrl, current.autoConvert, current.syncEnabled, current.syncIntervalMinutes])

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
    })
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
            <form className="row g-3" onSubmit={onSubmit}>
              <div className="col-12 col-md-6">
                <label className="form-label">Валюта отображения</label>
                <select
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
                  <input
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
                <input
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
              <input
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
                <IconPlus size={16} />
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
                      <IconTrash size={14} />
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
              Периодическая синхронизация данных (VPS, платежи) из BILLmanager для аккаунтов с настроенным API.
            </p>
            <form className="row g-3" onSubmit={onSyncSettingsSubmit}>
              <div className="col-12">
                <label className="form-check">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    checked={form.syncEnabled}
                    onChange={(e) => setForm((prev) => ({ ...prev, syncEnabled: e.target.checked }))}
                  />
                  <span className="form-check-label">Включить периодическую синхронизацию</span>
                </label>
              </div>
              <div className="col-12 col-md-6">
                <label className="form-label">Интервал (минуты)</label>
                <input
                  type="number"
                  min="15"
                  className="form-control"
                  value={form.syncIntervalMinutes}
                  onChange={(e) => setForm((prev) => ({ ...prev, syncIntervalMinutes: e.target.value }))}
                />
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
