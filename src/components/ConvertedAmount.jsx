import { convertWithProviderRate, formatCurrency } from '../lib/utils'

function sourceMeta(source) {
  if (source === 'provider') {
    return { label: 'Курс хостера', className: 'bg-green-lt text-green' }
  }
  if (source === 'global') {
    return { label: 'Глобальный курс', className: 'bg-blue-lt text-blue' }
  }
  return { label: 'Без конвертации', className: 'bg-secondary-lt text-secondary' }
}

export function ConvertedAmount({ amount, currency, provider, settings, ratesData }) {
  const result = convertWithProviderRate(amount, currency, provider, settings, ratesData)
  const meta = sourceMeta(result.source)

  return (
    <div>
      <div className="d-flex align-items-center gap-2">
        <span>{formatCurrency(result.value, result.currency)}</span>
        <span className={`badge ${meta.className}`}>{meta.label}</span>
      </div>
      <div className="text-secondary small">{formatCurrency(amount, currency)}</div>
    </div>
  )
}
