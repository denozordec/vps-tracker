import { useMemo, useState } from 'react'
import {
  convertCurrency,
  formatCurrency,
} from '../lib/utils'
import { EmptyState } from '../components/EmptyState'
import { PageHeader } from '../components/PageHeader'

function vpsMonthlyEstimateInBase(item, baseCurrency, ratesData) {
  if (item.status !== 'active') return 0
  const tariffType = item.tariffType || (Number(item.dailyRate || 0) > 0 ? 'daily' : 'monthly')
  const amount =
    tariffType === 'daily'
      ? Number(item.dailyRate || 0) * 30
      : Number(item.monthlyRate || 0)
  return convertCurrency(amount, item.currency || 'USD', baseCurrency, ratesData)
}

export function ResourcesPage({ db, settings, ratesData }) {
  const baseCurrency = settings?.[0]?.baseCurrency || 'RUB'
  const [groupBy, setGroupBy] = useState('project')
  const [filters, setFilters] = useState({
    providerId: '',
    providerAccountId: '',
    project: '',
    country: '',
    datacenter: '',
  })

  const customFields = Array.isArray(settings?.[0]?.customFields) ? settings[0].customFields : []

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

  const vpsFiltered = useMemo(() => {
    return (db.vps || []).filter((item) => {
      const byProvider = !filters.providerId || item.providerId === filters.providerId
      const byAccount =
        !filters.providerAccountId || item.providerAccountId === filters.providerAccountId
      const proj = (item.project || '').trim()
      const byProject =
        !filters.project ||
        (filters.project === '__none__' ? !proj : proj === filters.project)
      const byCountry =
        !filters.country || item.country?.toLowerCase().includes(filters.country.toLowerCase())
      const byDc =
        !filters.datacenter ||
        item.datacenter?.toLowerCase().includes(filters.datacenter.toLowerCase())
      const byCustom = customFields.every((f) => {
        const filterVal = (filters[f.key] || '').trim().toLowerCase()
        if (!filterVal) return true
        const itemVal = (item[f.key] || '').toLowerCase()
        return itemVal.includes(filterVal)
      })
      return byProvider && byAccount && byProject && byCountry && byDc && byCustom
    })
  }, [db.vps, filters, customFields])

  const groups = useMemo(() => {
    const map = new Map()
    const accounts = db.providerAccounts || []
    for (const item of vpsFiltered) {
      let key
      let label
      switch (groupBy) {
        case 'account': {
          const aid = item.providerAccountId || ''
          key = aid || '__none__'
          label = accounts.find((a) => a.id === aid)?.name || '—'
          break
        }
        case 'country': {
          const c = (item.country || '').trim()
          key = c || '__none__'
          label = key === '__none__' ? 'Не указано' : c
          break
        }
        case 'datacenter': {
          const dc = (item.datacenter || '').trim()
          key = dc || '__none__'
          label = key === '__none__' ? 'Не указано' : dc
          break
        }
        default: {
          const p = (item.project || '').trim()
          key = p || '__none__'
          label = key === '__none__' ? 'Без проекта' : p
        }
      }
      if (!map.has(key)) {
        map.set(key, {
          key,
          label,
          count: 0,
          activeCount: 0,
          vcpu: 0,
          ramGb: 0,
          diskGb: 0,
          forecast: 0,
        })
      }
      const g = map.get(key)
      g.count += 1
      if (item.status === 'active') g.activeCount += 1
      g.vcpu += Number(item.vcpu || 0)
      g.ramGb += Number(item.ramGb || 0)
      g.diskGb += Number(item.diskGb || 0)
      g.forecast += vpsMonthlyEstimateInBase(item, baseCurrency, ratesData)
    }
    const list = [...map.values()]
    list.sort((a, b) => {
      if (groupBy === 'account' || groupBy === 'project') {
        if (a.key === '__none__') return 1
        if (b.key === '__none__') return -1
      }
      return b.forecast - a.forecast || b.vcpu - a.vcpu
    })
    return list
  }, [vpsFiltered, groupBy, db.providerAccounts, baseCurrency, ratesData])

  const maxForecast = useMemo(
    () => groups.reduce((m, g) => Math.max(m, g.forecast), 0),
    [groups],
  )

  const totals = useMemo(() => {
    return groups.reduce(
      (acc, g) => ({
        count: acc.count + g.count,
        activeCount: acc.activeCount + g.activeCount,
        vcpu: acc.vcpu + g.vcpu,
        ramGb: acc.ramGb + g.ramGb,
        diskGb: acc.diskGb + g.diskGb,
        forecast: acc.forecast + g.forecast,
      }),
      { count: 0, activeCount: 0, vcpu: 0, ramGb: 0, diskGb: 0, forecast: 0 },
    )
  }, [groups])

  const defaultFilters = () => ({
    providerId: '',
    providerAccountId: '',
    project: '',
    country: '',
    datacenter: '',
    ...customFields.reduce((acc, f) => {
      acc[f.key] = ''
      return acc
    }, {}),
  })

  return (
    <>
      <PageHeader pretitle="Аналитика" title="Ресурсы и прогноз" />
      <div className="row row-cards">
        <div className="col-12">
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Группировка и фильтры</h3>
              <div className="card-actions">
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  onClick={() => setFilters(defaultFilters())}
                >
                  Сбросить
                </button>
              </div>
            </div>
            <div className="card-body">
              <div className="row g-2">
                <div className="col-12 col-md-6 col-xl-3">
                  <label className="form-label">Группировать по</label>
                  <select
                    className="form-select"
                    value={groupBy}
                    onChange={(e) => setGroupBy(e.target.value)}
                  >
                    <option value="project">Проект / пул</option>
                    <option value="account">Аккаунту</option>
                    <option value="country">Стране</option>
                    <option value="datacenter">Датацентру</option>
                  </select>
                </div>
                <div className="col-12 col-md-6 col-xl-3">
                  <label className="form-label">Хостер</label>
                  <select
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
                    <option value="">Все</option>
                    {(db.providers || []).map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-12 col-md-6 col-xl-3">
                  <label className="form-label">Аккаунт</label>
                  <select
                    className="form-select"
                    value={filters.providerAccountId}
                    onChange={(e) =>
                      setFilters((prev) => ({ ...prev, providerAccountId: e.target.value }))
                    }
                  >
                    <option value="">Все</option>
                    {accountFilterOptions.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-12 col-md-6 col-xl-3">
                  <label className="form-label">Проект (фильтр)</label>
                  <select
                    className="form-select"
                    value={filters.project}
                    onChange={(e) => setFilters((prev) => ({ ...prev, project: e.target.value }))}
                  >
                    <option value="">Все</option>
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
                  <input
                    className="form-control"
                    value={filters.country}
                    onChange={(e) => setFilters((prev) => ({ ...prev, country: e.target.value }))}
                    placeholder="Часть названия"
                  />
                </div>
                <div className="col-12 col-md-6 col-xl-3">
                  <label className="form-label">Датацентр</label>
                  <input
                    className="form-control"
                    value={filters.datacenter}
                    onChange={(e) =>
                      setFilters((prev) => ({ ...prev, datacenter: e.target.value }))
                    }
                    placeholder="Часть названия ДЦ"
                  />
                </div>
                {customFields.map((f) => (
                  <div key={f.key} className="col-12 col-md-6 col-xl-3">
                    <label className="form-label">{f.label}</label>
                    <input
                      className="form-control"
                      value={filters[f.key] ?? ''}
                      onChange={(e) =>
                        setFilters((prev) => ({ ...prev, [f.key]: e.target.value }))
                      }
                      placeholder={f.label}
                    />
                  </div>
                ))}
              </div>
              <div className="text-secondary small mt-2">
                Учтено VPS: {vpsFiltered.length} из {(db.vps || []).length}. Прогноз / мес — только
                активные (в базовой валюте).
              </div>
            </div>
          </div>
        </div>

        <div className="col-12">
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Сводка по группам</h3>
            </div>
            <div className="table-responsive">
              <table className="table card-table table-vcenter">
                <thead>
                  <tr>
                    <th>Группа</th>
                    <th className="text-end">VPS</th>
                    <th className="text-end">Активных</th>
                    <th className="text-end">vCPU</th>
                    <th className="text-end">RAM, GB</th>
                    <th className="text-end">Диск, GB</th>
                    <th className="text-end">Прогноз / мес</th>
                    <th style={{ minWidth: 120 }}>Доля прогноза</th>
                  </tr>
                </thead>
                <tbody>
                  {groups.map((g) => (
                    <tr key={g.key}>
                      <td className="fw-medium">{g.label}</td>
                      <td className="text-end">{g.count}</td>
                      <td className="text-end">{g.activeCount}</td>
                      <td className="text-end">{g.vcpu}</td>
                      <td className="text-end">{Number(g.ramGb.toFixed(1))}</td>
                      <td className="text-end">{g.diskGb}</td>
                      <td className="text-end">{formatCurrency(g.forecast, baseCurrency)}</td>
                      <td>
                        <div
                          className="progress progress-sm"
                          title={`${maxForecast > 0 ? Math.round((g.forecast / maxForecast) * 100) : 0}% от макс. группы`}
                        >
                          <div
                            className="progress-bar bg-primary"
                            style={{
                              width: `${maxForecast > 0 ? Math.min(100, (g.forecast / maxForecast) * 100) : 0}%`,
                            }}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                  {groups.length > 0 ? (
                    <tr className="table-active fw-medium">
                      <td>Итого</td>
                      <td className="text-end">{totals.count}</td>
                      <td className="text-end">{totals.activeCount}</td>
                      <td className="text-end">{totals.vcpu}</td>
                      <td className="text-end">{Number(totals.ramGb.toFixed(1))}</td>
                      <td className="text-end">{totals.diskGb}</td>
                      <td className="text-end">{formatCurrency(totals.forecast, baseCurrency)}</td>
                      <td />
                    </tr>
                  ) : null}
                  {groups.length === 0 ? (
                    <EmptyState message="Нет VPS по фильтрам" colSpan={8} />
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
