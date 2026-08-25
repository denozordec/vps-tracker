export type SnapshotRun = {
  id: string
  createdAt: string
  probePublicIp: string
}

export type BlockingSnapshotTick = {
  key: string
  asOf: string
  count: number
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

export function collectSnapshotTicks(runs: SnapshotRun[]): BlockingSnapshotTick[] {
  const byDay = new Map<string, SnapshotRun[]>()
  for (const run of runs) {
    const key = snapshotDayKey(run.createdAt)
    const list = byDay.get(key)
    if (list) list.push(run)
    else byDay.set(key, [run])
  }

  return [...byDay.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, list]) => ({
      key,
      count: list.length,
      asOf: list.reduce(
        (latest, run) => (run.createdAt > latest ? run.createdAt : latest),
        list[0]!.createdAt,
      ),
    }))
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
