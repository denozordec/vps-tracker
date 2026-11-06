import type { KeyboardEvent } from 'react'
import { ChevronLeftIcon, ChevronRightIcon, HistoryIcon } from 'lucide-react'

import { Badge } from '@/components/reui/badge'
import { Frame, FramePanel } from '@/components/reui/frame'
import { IconTile } from '@/components/reui/icon-tile'
import { Button } from '@cfdm/ui/components/button'
import { ToggleGroup, ToggleGroupItem } from '@cfdm/ui/components/toggle-group'
import { Tooltip, TooltipContent, TooltipTrigger } from '@cfdm/ui/components/tooltip'
import { cn } from '@cfdm/ui/lib/utils'

import { tickIndexAtOrBefore, type BlockingSnapshotTick, type SnapshotTone } from './blocking-snapshots'

const HOUR = 60 * 60 * 1000
const PRESETS = [
  { id: 'now', label: 'Сейчас', ms: 0 },
  { id: '1h', label: '−1 ч', ms: HOUR },
  { id: '6h', label: '−6 ч', ms: 6 * HOUR },
  { id: '24h', label: '−24 ч', ms: 24 * HOUR },
  { id: '7d', label: '−7 д', ms: 7 * 24 * HOUR },
] as const

/** Верхняя часть капсулы — доля прогонов часа с проблемой, цветом худшего результата. */
const TONE_FILL: Record<SnapshotTone, string> = {
  ok: 'bg-success',
  wn: 'bg-warning',
  er: 'bg-destructive',
}
const TONE_TEXT: Record<SnapshotTone, string> = { ok: 'text-success', wn: 'text-warning', er: 'text-destructive' }

function formatTickTime(iso: string, withDate = true): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleString('ru-RU', {
    ...(withDate ? { day: 'numeric', month: 'short' } : {}),
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Шкала времени по точкам измерений (час = точка). Лента капсул по образцу ReUI chart-34
 * (Cron Run History): высота — число проб, цвет — худший результат часа. Timeline из ReUI
 * статичен, поэтому навигация собрана из Button / ToggleGroup / Tooltip.
 */
export function BlockingSnapshotScrubber({
  ticks,
  index,
  onIndexChange,
  describeTick,
  issueLabel = 'с проблемами',
}: {
  ticks: BlockingSnapshotTick[]
  index: number
  onIndexChange: (index: number) => void
  /** Подпись под временем выбранной точки, напр. «4 пробы · 2 блокировки». */
  describeTick?: (tick: BlockingSnapshotTick) => string
  issueLabel?: string
}) {
  if (ticks.length === 0) return null

  const lastIndex = ticks.length - 1
  const selected = ticks[index] ?? ticks[lastIndex]!
  const isLatest = index >= lastIndex
  const maxCount = Math.max(...ticks.map((t) => t.count), 1)
  const latestMs = new Date(ticks[lastIndex]!.asOf).getTime()
  const go = (next: number) => onIndexChange(Math.min(lastIndex, Math.max(0, next)))

  const presetIndex = (ms: number) => (ms === 0 ? lastIndex : tickIndexAtOrBefore(ticks, latestMs - ms))
  // Подсвечиваем только «Сейчас»: «−N ч» — переход к ближайшей точке, не режим.
  const activePreset = isLatest ? 'now' : undefined

  const onStripKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowLeft') go(index - 1)
    else if (event.key === 'ArrowRight') go(index + 1)
    else if (event.key === 'Home') go(0)
    else if (event.key === 'End') go(lastIndex)
    else return
    event.preventDefault()
  }

  return (
    <Frame dense variant="default" spacing="sm" className="w-full min-w-0">
      <FramePanel className="flex flex-col gap-3 px-(--frame-panel-header-px) py-3">
        <div className="flex flex-wrap items-center gap-3">
          <IconTile variant="soft" size="sm" className={TONE_TEXT[selected.tone]} aria-hidden="true">
            <HistoryIcon />
          </IconTile>
          <div className="flex min-w-0 flex-1 basis-48 flex-col gap-px">
            <span className="flex items-center gap-2 text-sm font-medium">
              {isLatest ? 'Сейчас' : 'Снимок'} · {formatTickTime(selected.asOf)}
              <Badge size="sm" variant={isLatest ? 'success-light' : 'outline'}>
                {isLatest ? 'Актуально' : `${lastIndex - index} назад`}
              </Badge>
            </span>
            <span className="text-muted-foreground text-xs">
              {describeTick
                ? describeTick(selected)
                : `${selected.count} проб · ${selected.issues} ${issueLabel}`}
            </span>
          </div>
          <ToggleGroup
            variant="outline"
            size="sm"
            spacing={0}
            value={activePreset ? [activePreset] : []}
            onValueChange={(next) => {
              const preset = PRESETS.find((p) => p.id === next[0])
              if (!preset) return
              const target = presetIndex(preset.ms)
              go(target < 0 ? 0 : target)
            }}
            aria-label="Быстрый переход по времени"
          >
            {PRESETS.map((p) => (
              <ToggleGroupItem key={p.id} value={p.id}>
                {p.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              onClick={() => go(index - 1)}
              disabled={index <= 0}
              aria-label="Предыдущее измерение"
            >
              <ChevronLeftIcon />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              onClick={() => go(index + 1)}
              disabled={isLatest}
              aria-label="Следующее измерение"
            >
              <ChevronRightIcon />
            </Button>
          </div>
        </div>

        <div
          role="toolbar"
          aria-label="Точки измерений: ← → для перехода"
          tabIndex={0}
          onKeyDown={onStripKey}
          className="focus-visible:ring-ring/50 flex h-10 items-end justify-between gap-1 rounded-md outline-none focus-visible:ring-2"
        >
          {ticks.map((tick, i) => (
            <Tooltip key={tick.key}>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    tabIndex={-1}
                    aria-label={`${formatTickTime(tick.asOf)}: ${tick.count} проб, ${tick.issues} ${issueLabel}`}
                    aria-pressed={i === index}
                    onClick={() => go(i)}
                    className={cn(
                      'bg-success/60 hover:bg-success/80 relative flex min-w-1.5 max-w-16 flex-1 flex-col overflow-hidden rounded-sm transition-colors',
                      i === index && 'ring-foreground ring-offset-background ring-2 ring-offset-1',
                    )}
                    style={{ height: `${30 + (70 * tick.count) / maxCount}%` }}
                  />
                }
              >
                {tick.issues > 0 ? (
                  <span
                    aria-hidden="true"
                    className={cn('block w-full', TONE_FILL[tick.tone])}
                    style={{ height: `${Math.max(12, (100 * tick.issues) / tick.count)}%` }}
                  />
                ) : null}
              </TooltipTrigger>
              <TooltipContent>
                {formatTickTime(tick.asOf)} · {tick.count} проб · {tick.issues} {issueLabel}
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
        <div className="text-muted-foreground flex justify-between text-[11px] tabular-nums">
          <span>{formatTickTime(ticks[0]!.asOf)}</span>
          {ticks.length > 1 ? <span>{formatTickTime(ticks[lastIndex]!.asOf)}</span> : null}
        </div>
      </FramePanel>
    </Frame>
  )
}
