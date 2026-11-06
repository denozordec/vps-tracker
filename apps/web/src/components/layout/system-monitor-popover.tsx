import { useQuery } from '@tanstack/react-query'
import { Activity, ArrowRight } from 'lucide-react'
import { Link } from '@tanstack/react-router'

import { Badge } from '@/components/reui/badge'
import { Button } from '@cfdm/ui/components/button'
import { cn } from '@cfdm/ui/lib/utils'
import { Popover, PopoverContent, PopoverTrigger } from '@cfdm/ui/components/popover'

import { api } from '@/lib/api-client'
import { dashboardStatsQueryOptions } from '@/queries/dashboard'
import { snapshotQueryOptions } from '@/queries/snapshot'

type Tone = 'er' | 'wn' | 'ok'

/** Одна проверка монитора: строка в списке проблем (если не ok) и плитка с полосой. */
type MonitorCheck = {
  id: string
  label: string
  value: string
  percent: number
  tone: Tone
  title: string
  text: string
  to: '/sync-journal' | '/settings/notifications' | '/accounts' | '/vps' | '/dashboard'
}

// text-warning/text-success на белом фоне не проходят контраст — *-foreground в светлой теме (как в KPI).
const TONE_TEXT: Record<Tone, string> = {
  er: 'text-destructive',
  wn: 'text-warning-foreground dark:text-warning',
  ok: 'text-success-foreground dark:text-success',
}
const TONE_BG: Record<Tone, string> = { er: 'bg-destructive', wn: 'bg-warning', ok: 'bg-success' }

type SyncStatusRow = {
  accountId?: string
  status?: string | null
  ok?: boolean
}

function isStaleSync(lastAt: string | null | undefined): boolean {
  if (!lastAt) return true
  const ts = new Date(lastAt).getTime()
  if (Number.isNaN(ts)) return true
  return Date.now() - ts > 24 * 60 * 60 * 1000
}

function isSyncFailureStatus(row: SyncStatusRow): boolean {
  const status = String(row.status ?? '').toLowerCase()
  return status === 'failed' || status === 'error' || row.ok === false
}

/** Последний синк на аккаунт (журнал desc по startedAt); старые fail после OK игнорируются. */
function countCurrentSyncFailures(rows: SyncStatusRow[]): number {
  const seen = new Set<string>()
  let failed = 0
  for (const row of rows) {
    const accountId = row.accountId
    if (!accountId || seen.has(accountId)) continue
    seen.add(accountId)
    if (isSyncFailureStatus(row)) failed += 1
  }
  return failed
}

type NotifyLogRow = {
  status?: string | null
  createdAt?: string | null
}

const NOTIFY_FAIL_WINDOW_MS = 24 * 60 * 60 * 1000

export function countRecentFailedNotifications(
  rows: NotifyLogRow[],
  maxAgeMs = NOTIFY_FAIL_WINDOW_MS,
  now = Date.now(),
): number {
  return rows.filter((n) => {
    if (String(n.status ?? '').toLowerCase() !== 'failed') return false
    const ts = new Date(n.createdAt ?? '').getTime()
    if (Number.isNaN(ts)) return false
    return now - ts <= maxAgeMs
  }).length
}

/** Центр состояния в шапке — та же разметка, что «Внимание» в макете и EvoBGP. */
export function SystemMonitorPopover() {
  const statsQ = useQuery({ ...dashboardStatsQueryOptions(), refetchInterval: 30_000 })
  const snapQ = useQuery({ ...snapshotQueryOptions(), refetchInterval: 30_000 })
  const syncQ = useQuery({
    queryKey: ['sync', 'status'],
    queryFn: () => api.fetchSyncStatus() as Promise<SyncStatusRow[]>,
    refetchInterval: 30_000,
  })
  const notifyQ = useQuery({
    queryKey: ['notifications', 'log', 'monitor'],
    queryFn: () => api.fetchNotificationLog(20),
    refetchInterval: 30_000,
  })

  const stats = statsQ.data
  const vps = snapQ.data?.vps ?? []
  const monitored = vps.filter((v) => (v as { monitoringEnabled?: boolean }).monitoringEnabled).length
  const downCount = vps.filter((v) => (v as { lastHealthStatus?: string }).lastHealthStatus === 'down').length
  const issuesCount = stats?.issuesCount ?? 0
  const runwayDays = stats?.minRunwayDays
  const runwayLow = runwayDays != null && runwayDays < 14
  const lowBalance = (stats?.lowBalanceAccountCount ?? 0) > 0
  const staleSync = (stats?.staleSyncAccountCount ?? 0) > 0 || isStaleSync(stats?.lastGlobalSyncAt)
  const failedSyncCount = countCurrentSyncFailures(syncQ.data ?? [])
  const failedNotifications = countRecentFailedNotifications(notifyQ.data ?? [])
  const apiOk = Boolean(statsQ.data) || Boolean(snapQ.data)
  const updatedAt = Math.max(statsQ.dataUpdatedAt, snapQ.dataUpdatedAt)

  const checks: MonitorCheck[] = [
    {
      id: 'sync',
      label: 'Синк',
      value: failedSyncCount > 0 ? String(failedSyncCount) : staleSync ? 'устарел' : 'OK',
      percent: failedSyncCount > 0 || staleSync ? 35 : 100,
      tone: failedSyncCount > 0 ? 'er' : staleSync ? 'wn' : 'ok',
      title: failedSyncCount > 0 ? 'Ошибка синхронизации' : 'Синк давно не выполнялся',
      text:
        failedSyncCount > 0
          ? `${failedSyncCount} акк. с ошибкой последнего синка`
          : 'Нет успешного синка за 24 ч',
      to: '/sync-journal',
    },
    {
      id: 'notifications',
      label: 'Уведомления',
      value: `${failedNotifications} шт.`,
      percent: Math.min(100, failedNotifications * 15),
      tone: failedNotifications > 0 ? 'wn' : 'ok',
      title: 'Уведомления не доставлены',
      text: `${failedNotifications} за 24 ч — проверьте Telegram / webhook`,
      to: '/settings/notifications',
    },
    {
      id: 'runway',
      label: 'Запас дней',
      value: runwayDays != null ? `${runwayDays} дн` : '—',
      percent: runwayDays == null ? 0 : Math.min(100, Math.round((runwayDays / 30) * 100)),
      tone: runwayLow || lowBalance ? 'wn' : 'ok',
      title: lowBalance ? 'Низкий баланс аккаунта' : 'Мало денег у хостера',
      text: runwayDays != null ? `Хватит примерно на ${runwayDays} дн` : 'Баланс ниже порога',
      to: '/accounts',
    },
    {
      id: 'vps-down',
      label: 'VPS down',
      value: monitored ? `${downCount} из ${monitored}` : String(downCount),
      percent: monitored ? Math.round(((monitored - downCount) / monitored) * 100) : 100,
      tone: downCount > 0 ? 'er' : 'ok',
      title: 'VPS недоступны',
      text: `${downCount} не отвечают на uptime-проверку`,
      to: '/vps',
    },
  ]
  const problems: Omit<MonitorCheck, 'label' | 'value' | 'percent'>[] = [
    ...(apiOk
      ? []
      : [{ id: 'api', tone: 'er' as const, title: 'API недоступно', text: 'Нет ответа от сервера', to: '/dashboard' as const }]),
    ...checks.filter((c) => c.tone !== 'ok'),
    ...(issuesCount > 0
      ? [
          {
            id: 'inventory',
            tone: 'wn' as const,
            title: 'Проблемы инвентаря',
            text: `${issuesCount} категор. на дашборде`,
            to: '/dashboard' as const,
          },
        ]
      : []),
  ]
  const errors = problems.filter((p) => p.tone === 'er').length
  const warnings = problems.length - errors
  const okCount = checks.filter((c) => c.tone === 'ok').length
  const status: Tone = errors > 0 ? 'er' : warnings > 0 ? 'wn' : 'ok'
  const statusLabel = status === 'er' ? 'Сбой' : status === 'wn' ? 'Внимание' : 'Норма'
  // Кнопка подсвечена, пока есть что смотреть; в норме — спокойный outline.
  const alert = status !== 'ok'

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            type="button"
            aria-label={`Монитор VPS Tracker: ${statusLabel.toLowerCase()}, ${errors} сбой, ${warnings} предупреждения`}
            className={cn(
              'relative h-8 gap-2 px-2 max-[760px]:w-8 max-[760px]:border-transparent max-[760px]:bg-transparent max-[760px]:px-0',
              alert && 'border-warning/40 bg-warning/10 hover:bg-warning/20 aria-expanded:bg-warning/20',
            )}
          />
        }
      >
        <Activity className={cn('size-4', alert ? 'text-warning' : 'text-success')} aria-hidden />
        <span
          className={cn('hidden text-sm font-medium min-[1000px]:inline', alert ? 'text-warning-foreground dark:text-warning' : 'text-success-foreground dark:text-success')}
        >
          {alert ? 'Внимание' : 'Норма'}
        </span>
        {alert ? (
          <>
            <span className="hidden items-center gap-1.5 text-sm tabular-nums min-[1240px]:inline-flex">
              <span className="bg-destructive size-1.5 rounded-full" aria-hidden />
              {errors}
              <span className="bg-warning size-1.5 rounded-full" aria-hidden />
              {warnings}
            </span>
            <span className="bg-destructive hidden size-4.5 min-w-4.5 items-center justify-center rounded-full px-1 text-[11px] font-semibold text-white min-[760px]:inline-flex min-[1240px]:hidden">
              {problems.length}
            </span>
            <span
              className="bg-destructive ring-background absolute top-1 right-1 size-2 rounded-full ring-2 min-[760px]:hidden"
              aria-hidden
            />
          </>
        ) : null}
      </PopoverTrigger>
      <PopoverContent align="end" className="flex w-[24rem] max-w-[calc(100vw-1.5rem)] flex-col gap-2 p-2">
        <div className="flex items-start justify-between gap-2 px-1.5 pt-1.5">
          <div className="grid leading-tight">
            <b className="text-sm font-semibold">Монитор VPS Tracker</b>
            <span className="text-muted-foreground text-xs">
              {updatedAt ? `обновлено ${new Date(updatedAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}` : 'загрузка…'}
            </span>
          </div>
          <Badge
            variant={status === 'er' ? 'destructive-light' : status === 'wn' ? 'warning-light' : 'success-light'}
            size="sm"
          >
            {statusLabel}
          </Badge>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {[
            { n: errors, l: 'сбой', t: 'er' as const },
            { n: warnings, l: 'предупреждения', t: 'wn' as const },
            { n: okCount, l: 'в норме', t: 'ok' as const },
          ].map((x) => (
            <span
              key={x.l}
              className="bg-muted/55 text-muted-foreground flex flex-col rounded-lg px-2.5 py-2 text-[11.5px]"
            >
              <b className={cn('text-lg leading-tight font-semibold tabular-nums', TONE_TEXT[x.t])}>{x.n}</b>
              {x.l}
            </span>
          ))}
        </div>
        {problems.length > 0 ? (
          <ul className="flex flex-col gap-0.5">
            {problems.map((p) => (
              <li key={p.id}>
                <Link
                  to={p.to}
                  className="hover:bg-muted/55 focus-visible:bg-muted/55 flex items-center gap-2.5 rounded-md px-1.5 py-2 outline-none"
                >
                  <span aria-hidden className={cn('size-2 shrink-0 rounded-full', TONE_BG[p.tone])} />
                  <span className="grid min-w-0 flex-1 leading-tight">
                    <b className="truncate text-[13px] font-medium">{p.title}</b>
                    <span className="text-muted-foreground truncate text-xs">{p.text}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
        <div className="grid grid-cols-2 gap-1.5">
          {checks.map((c) => (
            <div key={c.id} className="bg-muted/55 flex min-w-0 flex-col gap-1.5 rounded-lg px-3 py-2.5">
              <span className="text-muted-foreground text-xs leading-snug">{c.label}</span>
              <b className={cn('text-base font-semibold whitespace-nowrap tabular-nums', TONE_TEXT[c.tone])}>
                {c.value}
              </b>
              <div className="bg-muted-foreground/25 mt-auto h-[3px] overflow-hidden rounded-full">
                <i className={cn('block h-full rounded-full', TONE_BG[c.tone])} style={{ width: `${c.percent}%` }} />
              </div>
            </div>
          ))}
        </div>
        <Link
          to="/sync-journal"
          className="text-muted-foreground hover:text-foreground flex items-center justify-between px-1.5 pt-1 pb-0.5 text-sm transition-colors"
        >
          Журнал синка
          <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      </PopoverContent>
    </Popover>
  )
}
