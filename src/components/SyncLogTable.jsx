import { EmptyState } from './EmptyState'

export function SyncLogTable({ syncLog = [], providerAccounts = [] }) {
  const getAccountName = (accountId) => {
    const account = providerAccounts.find((a) => a.id === accountId)
    return account?.name || accountId
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return '—'
    try {
      const d = new Date(dateStr)
      return Number.isNaN(d.getTime()) ? dateStr : d.toLocaleString('ru-RU')
    } catch {
      return dateStr
    }
  }

  const statusBadge = (status) => {
    if (status === 'ok') return 'bg-green-lt text-green'
    if (status === 'error') return 'bg-red-lt text-red'
    if (status === 'running') return 'bg-blue-lt text-blue'
    return 'bg-secondary-lt'
  }

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">Журнал синхронизации</h3>
      </div>
      <div className="table-responsive">
        <table className="table card-table table-vcenter">
          <thead>
            <tr>
              <th>Аккаунт</th>
              <th>Начало</th>
              <th>Окончание</th>
              <th>Статус</th>
              <th>VPS</th>
              <th>Платежи</th>
              <th>Ошибка</th>
            </tr>
          </thead>
          <tbody>
            {syncLog.map((row) => (
              <tr key={row.id || `${row.accountId}-${row.startedAt}`}>
                <td>{getAccountName(row.accountId)}</td>
                <td>{formatDate(row.startedAt)}</td>
                <td>{formatDate(row.finishedAt)}</td>
                <td>
                  <span className={`badge ${statusBadge(row.status)}`}>
                    {row.status === 'ok' ? 'OK' : row.status === 'error' ? 'Ошибка' : row.status === 'running' ? 'Выполняется' : row.status || '—'}
                  </span>
                </td>
                <td>{row.vpsCount ?? '—'}</td>
                <td>{row.paymentsCount ?? '—'}</td>
                <td>
                  {row.error ? (
                    <span className="text-danger small" title={row.error}>
                      {row.error.length > 50 ? `${row.error.slice(0, 50)}…` : row.error}
                    </span>
                  ) : (
                    '—'
                  )}
                </td>
              </tr>
            ))}
            {syncLog.length === 0 ? (
              <EmptyState message="Нет записей синхронизации" colSpan={7} />
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  )
}
