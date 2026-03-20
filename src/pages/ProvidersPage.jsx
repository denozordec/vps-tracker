import { useState } from 'react'
import { UiModal } from '../components/UiModal'
import { EmptyState } from '../components/EmptyState'
import { PageHeader } from '../components/PageHeader'
import { faviconUrlFromWebsite } from '../lib/utils'
import { noBrowserSuggestProps } from '../lib/noBrowserSuggestProps'

const emptyForm = {
  name: '',
  website: '',
  contact: '',
  baseCurrency: 'RUB',
  usdRate: '',
  eurRate: '',
  notes: '',
  apiType: '',
  apiBaseUrl: '',
}

export function ProvidersPage({ db, actions }) {
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const onSubmit = (event) => {
    event.preventDefault()
    if (!form.name.trim()) {
      return
    }
    if (editingId) {
      actions.update('providers', editingId, form)
    } else {
      actions.create('providers', form)
    }
    setForm(emptyForm)
    setEditingId(null)
    setIsModalOpen(false)
  }

  const onEdit = (provider) => {
    setForm({
      name: provider.name || '',
      website: provider.website || '',
      contact: provider.contact || '',
      baseCurrency: provider.baseCurrency || 'RUB',
      usdRate: provider.usdRate || '',
      eurRate: provider.eurRate || '',
      notes: provider.notes || '',
      apiType: provider.apiType || '',
      apiBaseUrl: provider.apiBaseUrl || '',
    })
    setEditingId(provider.id)
    setIsModalOpen(true)
  }

  return (
    <>
      <PageHeader pretitle="Справочники" title="Хостеры" />
      <div className="row row-cards">
        <div className="col-12">
          <div className="card">
          <div className="card-header">
            <h3 className="card-title">Список хостеров</h3>
            <div className="card-actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  setForm(emptyForm)
                  setEditingId(null)
                  setIsModalOpen(true)
                }}
              >
                Добавить хостера
              </button>
            </div>
          </div>
          <div className="table-responsive">
            <table className="table card-table table-vcenter">
              <thead>
                <tr>
                  <th>Название</th>
                  <th>Сайт</th>
                  <th>Валюта / курсы</th>
                  <th>Контакт</th>
                  <th>API</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {db.providers.map((provider) => (
                  <tr key={provider.id}>
                    <td>
                      <div className="d-flex align-items-center gap-2">
                        {faviconUrlFromWebsite(provider.website) ? (
                          <img
                            src={faviconUrlFromWebsite(provider.website)}
                            alt=""
                            width="16"
                            height="16"
                            className="rounded"
                          />
                        ) : null}
                        <span>{provider.name}</span>
                      </div>
                    </td>
                    <td>{provider.website || '-'}</td>
                    <td>
                      <div>{provider.baseCurrency || 'RUB'}</div>
                      <div className="text-secondary small">
                        USD: {provider.usdRate || 'auto'} / EUR: {provider.eurRate || 'auto'}
                      </div>
                    </td>
                    <td>{provider.contact || '-'}</td>
                    <td>
                      {provider.apiType === 'billmanager' && (provider.apiBaseUrl || '').trim() ? (
                        <span className="text-secondary small">BILLmanager</span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="text-end">
                      <div className="table-actions">
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-primary"
                          onClick={() => onEdit(provider)}
                        >
                          Изменить
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-danger"
                          onClick={() => actions.remove('providers', provider.id)}
                        >
                          Удалить
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {db.providers.length === 0 ? (
                  <EmptyState message="Пока нет хостеров" colSpan={6} />
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
        </div>
      </div>

      <UiModal
        open={isModalOpen}
        title={editingId ? 'Редактировать хостера' : 'Добавить хостера'}
        onClose={() => {
          setIsModalOpen(false)
          setEditingId(null)
          setForm(emptyForm)
        }}
        size="modal-md"
      >
        <form autoComplete="off" onSubmit={onSubmit} className="row g-3">
          <div className="col-12">
            <label className="form-label">Название</label>
            <input {...noBrowserSuggestProps}
              className="form-control"
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              required
            />
          </div>
          <div className="col-12">
            <label className="form-label">Сайт</label>
            <input {...noBrowserSuggestProps}
              className="form-control"
              value={form.website}
              onChange={(e) => setForm((prev) => ({ ...prev, website: e.target.value }))}
            />
          </div>
          <div className="col-12">
            <label className="form-label">Контакт</label>
            <input {...noBrowserSuggestProps}
              className="form-control"
              value={form.contact}
              onChange={(e) => setForm((prev) => ({ ...prev, contact: e.target.value }))}
            />
          </div>
          <div className="col-12 col-sm-4">
            <label className="form-label">Валюта приёма платежей</label>
            <select autoComplete="off"
              className="form-select"
              value={form.baseCurrency}
              onChange={(e) => setForm((prev) => ({ ...prev, baseCurrency: e.target.value }))}
            >
              <option>RUB</option>
              <option>USD</option>
              <option>EUR</option>
            </select>
            <div className="text-secondary small">Валюта, в которой хостер принимает платежи</div>
          </div>
          <div className="col-12 col-sm-4">
            <label className="form-label">Курс USD</label>
            <input {...noBrowserSuggestProps}
              type="number"
              min="0"
              step="0.0001"
              className="form-control"
              placeholder="auto"
              value={form.usdRate}
              onChange={(e) => setForm((prev) => ({ ...prev, usdRate: e.target.value }))}
            />
          </div>
          <div className="col-12 col-sm-4">
            <label className="form-label">Курс EUR</label>
            <input {...noBrowserSuggestProps}
              type="number"
              min="0"
              step="0.0001"
              className="form-control"
              placeholder="auto"
              value={form.eurRate}
              onChange={(e) => setForm((prev) => ({ ...prev, eurRate: e.target.value }))}
            />
          </div>
          <div className="col-12">
            <label className="form-label">Заметки</label>
            <textarea {...noBrowserSuggestProps}
              className="form-control"
              value={form.notes}
              onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
            />
          </div>
          <div className="col-12">
            <hr className="my-2" />
            <h6 className="text-secondary mb-2">Интеграция API (один URL на хостера)</h6>
            <div className="text-secondary small mb-2">
              Логин и пароль API — в разделе «Аккаунты хостеров»; проверка соединения доступна там при вводе
              учётных данных.
            </div>
          </div>
          <div className="col-12">
            <label className="form-label">Тип API</label>
            <select
              autoComplete="off"
              className="form-select"
              value={form.apiType}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  apiType: e.target.value,
                  apiBaseUrl: e.target.value === 'billmanager' ? prev.apiBaseUrl : '',
                }))
              }
            >
              <option value="">— Не использовать —</option>
              <option value="billmanager">BILLmanager</option>
            </select>
          </div>
          {form.apiType === 'billmanager' ? (
            <div className="col-12">
              <label className="form-label">URL API BILLmanager</label>
              <input
                {...noBrowserSuggestProps}
                className="form-control"
                placeholder="https://bill.example.com:1500/billmgr"
                value={form.apiBaseUrl}
                onChange={(e) => setForm((prev) => ({ ...prev, apiBaseUrl: e.target.value }))}
              />
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
