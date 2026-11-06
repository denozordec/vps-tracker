export type SnapshotRun = {
  id: string
  createdAt: string
  probePublicIp: string
}

export type SnapshotTone = 'ok' | 'wn' | 'er'

export type BlockingSnapshotTick = {
  /** Час измерения `YYYY-MM-DDTHH` (UTC) — точка на шкале времени. */
  key: string
  asOf: string
  count: number
  /** Худший результат среди прогонов этого часа — цвет столбика на шкале. */
  tone: SnapshotTone
  /** Сколько прогонов часа с проблемой (блокировка / расхождение). */
  issues: number
}

const TONE_RANK: Record<SnapshotTone, number> = { ok: 0, wn: 1, er: 2 }

/** Ключ точки шкалы: прогоны группируются по часу — несколько проверок за день видны отдельно. */
export function snapshotHourKey(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso.slice(0, 13)
  return date.toISOString().slice(0, 13)
}

export function snapshotDayKey(iso: string): string {
  if (/^\d{4}-\d{2}-\d{2}/.test(iso)) return iso.slice(0, 10)
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso.slice(0, 10)
  return date.toISOString().slice(0, 10)
}

export function formatSnapshotTickLabel(dayKey: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dayKey)) return dayKey
  const date = new Date(`${dayKey}T12:00:00.000Z`)
  if (Number.isNaN(date.getTime())) return dayKey
  return date.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  })
}

export function mergeCensorcheckRuns<T extends { id: string }>(
  current: T[],
  history: T[],
): T[] {
  const map = new Map<string, T>()
  for (const run of history) map.set(run.id, run)
  for (const run of current) map.set(run.id, run)
  return [...map.values()]
}

export function collectSnapshotTicks<T extends SnapshotRun>(
  runs: T[],
  toneOf: (run: T) => SnapshotTone = () => 'ok',
): BlockingSnapshotTick[] {
  const byHour = new Map<string, T[]>()
  for (const run of runs) {
    const key = snapshotHourKey(run.createdAt)
    const list = byHour.get(key)
    if (list) list.push(run)
    else byHour.set(key, [run])
  }

  return [...byHour.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, list]) => {
      const tones = list.map(toneOf)
      return {
        key,
        count: list.length,
        tone: tones.reduce<SnapshotTone>((worst, t) => (TONE_RANK[t] > TONE_RANK[worst] ? t : worst), 'ok'),
        issues: tones.filter((t) => t !== 'ok').length,
        asOf: list.reduce(
          (latest, run) => (run.createdAt > latest ? run.createdAt : latest),
          list[0]!.createdAt,
        ),
      }
    })
}

/** Индекс последней точки не позже `atMs` (для пресетов «−1 ч», «−24 ч»); -1 — раньше первой точки. */
export function tickIndexAtOrBefore(ticks: BlockingSnapshotTick[], atMs: number): number {
  let found = -1
  ticks.forEach((tick, i) => {
    if (new Date(tick.asOf).getTime() <= atMs) found = i
  })
  return found
}

/** Latest run per probe IP at or before `asOf`. */
export function latestRunsAsOf<T extends SnapshotRun>(
  runs: T[],
  asOf: string,
): T[] {
  if (!asOf) return []
  const byIp = new Map<string, T>()
  for (const run of runs) {
    if (run.createdAt > asOf) continue
    const previous = byIp.get(run.probePublicIp)
    if (
      !previous ||
      run.createdAt > previous.createdAt ||
      (run.createdAt === previous.createdAt && run.id > previous.id)
    ) {
      byIp.set(run.probePublicIp, run)
    }
  }
  return [...byIp.values()].sort((left, right) => right.createdAt.localeCompare(left.createdAt))
}

export function resolveSnapshotIndex(
  tickCount: number,
  selected: number | null,
): number {
  if (tickCount <= 0) return 0
  if (selected == null) return tickCount - 1
  return Math.min(Math.max(selected, 0), tickCount - 1)
}
