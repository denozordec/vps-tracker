/** Поля VPS, которые BILLmanager-синк может перезаписывать (см. sync.ts). */
export const VPS_SYNC_OVERRIDE_FIELDS = [
  { key: 'country', label: 'Страна' },
  { key: 'city', label: 'Город' },
  { key: 'datacenter', label: 'Дата-центр' },
  { key: 'os', label: 'ОС' },
  { key: 'project', label: 'Проект' },
  { key: 'notes', label: 'Заметки' },
  { key: 'status', label: 'Статус' },
  { key: 'tariffType', label: 'Тип тарифа' },
  { key: 'currency', label: 'Валюта' },
  { key: 'dailyRate', label: 'Ставка/день' },
  { key: 'monthlyRate', label: 'Ставка/мес' },
  { key: 'paidUntil', label: 'Оплачено до' },
] as const

export type VpsSyncOverrideField = (typeof VPS_SYNC_OVERRIDE_FIELDS)[number]['key']

export function parseUserOverrides(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.filter((x) => typeof x === 'string')
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw) as unknown
      if (Array.isArray(parsed)) return parsed.filter((x) => typeof x === 'string')
    } catch {
      return []
    }
  }
  return []
}
