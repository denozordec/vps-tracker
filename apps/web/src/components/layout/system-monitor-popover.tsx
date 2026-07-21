import { useMemo, type CSSProperties, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Activity,
  ListChecks,
  RefreshCw,
  Server,
  Wallet,
} from 'lucide-react'

import { Badge } from '@/components/reui/badge'
import { cn } from '@cfdm/ui/lib/utils'
import { Item, ItemMedia } from '@cfdm/ui/components/item'
import { Popover, PopoverContent, PopoverTrigger } from '@cfdm/ui/components/popover'
import { Progress } from '@cfdm/ui/components/progress'

import { api } from '@/lib/api-client'
import { dashboardStatsQueryOptions } from '@/queries/dashboard'
import { snapshotQueryOptions } from '@/queries/snapshot'

type MonitorMetric = {
  id: string
  label: string
  value: string
  unit: string
  percent: number
  icon: ReactNode
  tone: 'success' | 'warning' | 'destructive' | 'info'
  alert: boolean
}

function toneColor(tone: MonitorMetric['tone']) {
  switch (tone) {
    case 'success':
      return 'var(--color-success)'
    case 'warning':
      return 'var(--color-warning)'
    case 'destructive':
      return 'var(--color-destructive)'
    default:
      return 'var(--color-info)'
  }
}

function MetricCell({ metric }: { metric: MonitorMetric }) {
  const color = toneColor(metric.tone)
  return (
    <div className="flex flex-col gap-2 p-3">
      <div className="flex items-center justify-between gap-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <Item
            className="flex size-5 shrink-0 items-center justify-center p-0"
            style={{ backgroundColor: `${color}18` }}
          >
            <ItemMedia variant="icon" className="size-auto" style={{ color }}>
              {metric.icon}
            </ItemMedia>
          </Item>
          <span className="text-muted-foreground truncate text-[11px]">{metric.label}</span>
        </div>
        <span className="shrink-0 text-xs font-semibold tabular-nums" style={{ color }}>
          {metric.value}
          <span className="text-muted-foreground ml-0.5 text-[10px] font-normal">{metric.unit}</span>
        </span>
      </div>
      <Progress
        value={metric.percent}
        className="**:data-[slot=progress-indicator]:bg-(--bar-color) **:data-[slot=progress-track]:h-1"
        style={{ '--bar-color': color } as CSSProperties}
      />
    </div>
  )
}

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

/** Live system monitor popover (app-shell pattern, VPS Tracker API data). */
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
  const downCount = vps.filter((v) => {
    const status = (v as { lastHealthStatus?: string }).lastHealthStatus
    return status === 'down'
  }).length
  const issuesCount = stats?.issuesCount ?? 0
  const runwayDays = stats?.minRunwayDays
  const runwayLow = runwayDays != null && runwayDays < 14
  const lowBalance = (stats?.lowBalanceAccountCount ?? 0) > 0
  const staleSync =
    (stats?.staleSyncAccountCount ?? 0) > 0 || isStaleSync(stats?.lastGlobalSyncAt)
  const failedSyncCount = countCurrentSyncFailures(syncQ.data ?? [])
  const recentSyncFailed = failedSyncCount > 0
  const syncAlert = staleSync || recentSyncFailed
  const failedNotifications = (notifyQ.data ?? []).filter(
    (n) => String(n.status ?? '').toLowerCase() === 'failed',
  ).length
  const apiOk = Boolean(statsQ.data) || Boolean(snapQ.data)

  const metrics = useMemo<MonitorMetric[]>(
    () => [
      {
        id: 'sync',
        label: 'Синк',
        value: recentSyncFailed ? String(failedSyncCount) : syncAlert ? '!' : 'OK',
        unit: '',
        percent: syncAlert ? 35 : 100,
        icon: <RefreshCw aria-hidden />,
        tone: syncAlert ? (recentSyncFailed ? 'destructive' : 'warning') : 'success',
        alert: syncAlert,
      },
      {
        id: 'inventory',
        label: 'Инвентарь',
        value: String(issuesCount),
        unit: 'шт.',
        percent: Math.min(100, issuesCount * 15),
        icon: <ListChecks aria-hidden />,
        tone: issuesCount > 0 ? 'warning' : 'success',
        alert: issuesCount > 0,
      },
      {
        id: 'runway',
        label: 'Запас дней',
        value: runwayDays != null ? String(runwayDays) : '—',
        unit: runwayDays != null ? 'дн' : '',
        percent:
          runwayDays == null
            ? 0
            : Math.min(100, Math.round((runwayDays / 30) * 100)),
        icon: <Wallet aria-hidden />,
        tone: runwayLow || lowBalance ? 'warning' : 'success',
        alert: runwayLow || lowBalance,
      },
      {
        id: 'vps-down',
        label: 'VPS down',
        value: String(downCount),
        unit: 'шт.',
        percent: Math.min(100, downCount * 25),
        icon: <Server aria-hidden />,
        tone: downCount > 0 ? 'destructive' : 'success',
        alert: downCount > 0,
      },
    ],
    [downCount, failedSyncCount, issuesCount, lowBalance, recentSyncFailed, runwayDays, runwayLow, syncAlert],
  )

  const spiking = metrics.some((m) => m.alert) || !apiOk || failedNotifications > 0

  return (
    <Popover>
      <PopoverTrigger
        render={
          <button
            type="button"
            aria-label="Монитор системы"
            className={cn(
              'relative inline-flex h-8 items-center gap-1.5 rounded-md border px-2 transition-colors outline-none',
              'border-border hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring',
            )}
          />
        }
      >
        <span className="relative flex size-3.5 items-center justify-center">
          <Activity
            aria-hidden
            className={cn(
              'size-3.5 transition-colors',
              spiking ? 'text-destructive' : 'text-muted-foreground',
            )}
          />
          {spiking ? (
            <span className="bg-destructive/25 absolute inset-0 animate-ping rounded-full" aria-hidden />
          ) : null}
        </span>
        <span className="text-foreground hidden text-xs font-medium sm:inline">Система</span>
        <Badge
          variant={spiking ? 'destructive-light' : 'success-light'}
          size="xs"
          className="h-4 px-1.5 text-[10px]"
        >
          {spiking ? 'Внимание' : 'Норма'}
        </Badge>
      </PopoverTrigger>

      <PopoverContent align="end" sideOffset={8} className="flex w-80 flex-col gap-0! p-0!">
        <div className="border-border flex items-center justify-between border-b px-3 py-2.5">
          <span className="text-foreground text-xs font-medium">Монитор VPS Tracker</span>
          <span className="text-muted-foreground text-[11px] tabular-nums">
            {new Date().toLocaleTimeString('ru-RU')}
          </span>
        </div>
        <div className="grid grid-cols-2">
          {metrics.map((metric, i) => (
            <div
              key={metric.id}
              className={cn(
                i % 2 === 1 && 'border-border border-l',
                i >= 2 && 'border-border border-t',
              )}
            >
              <MetricCell metric={metric} />
            </div>
          ))}
        </div>
        <div className="border-border text-muted-foreground border-t px-3 py-2 text-[11px]">
          API:{' '}
          <span className="text-foreground font-medium">{apiOk ? 'OK' : '—'}</span>
          {' · '}
          Уведомлений с ошибкой:{' '}
          <span className="text-foreground font-medium tabular-nums">{failedNotifications}</span>
          {stats?.lastGlobalSyncAt ? (
            <>
              {' · '}
              Синк:{' '}
              <span className="text-foreground font-medium tabular-nums">
                {new Date(stats.lastGlobalSyncAt).toLocaleString('ru-RU')}
              </span>
            </>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  )
}
