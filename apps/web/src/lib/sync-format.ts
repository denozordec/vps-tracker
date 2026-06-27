export function formatRelativeSyncTime(iso: string | null | undefined): string {
  if (!iso) return 'нет данных'
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return 'нет данных'
  const diffMs = Date.now() - t
  const mins = Math.floor(diffMs / 60_000)
  if (mins < 1) return 'только что'
  if (mins < 60) return `${mins} мин назад`
  const hours = Math.floor(mins / 60)
  if (hours < 48) return `${hours} ч назад`
  const days = Math.floor(hours / 24)
  return `${days} дн назад`
}
