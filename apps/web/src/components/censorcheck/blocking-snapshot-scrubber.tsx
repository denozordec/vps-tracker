import { Badge } from '@/components/reui/badge'
import { Frame, FramePanel } from '@/components/reui/frame'
import {
  Timeline,
  TimelineDate,
  TimelineHeader,
  TimelineIndicator,
  TimelineItem,
  TimelineSeparator,
} from '@/components/reui/timeline'
import { Slider } from '@cfdm/ui/components/slider'
import { cn } from '@cfdm/ui/lib/utils'

import {
  formatSnapshotTickLabel,
  type BlockingSnapshotTick,
} from './blocking-snapshots'
import { formatCheckedAt } from './types'

/** DNA: c-timeline-12 + shadcn Slider. Preview: https://reui.io/preview/base/components/c-timeline-12 */
export function BlockingSnapshotScrubber({
  ticks,
  index,
  onIndexChange,
}: {
  ticks: BlockingSnapshotTick[]
  index: number
  onIndexChange: (index: number) => void
}) {
  if (ticks.length === 0) return null

  const selected = ticks[index] ?? ticks[ticks.length - 1]!
  const lastIndex = ticks.length - 1
  const isLatest = index >= lastIndex
  const max = Math.max(0, lastIndex)

  const handleSlider = (next: number | readonly number[]) => {
    const value = Array.isArray(next) ? next[0] : next
    if (typeof value === 'number') onIndexChange(value)
  }

  return (
    <Frame dense variant="default" spacing="sm" className="w-full min-w-0">
      <FramePanel className="flex flex-col gap-3 px-(--frame-panel-header-px) py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-px">
            <span className="text-sm font-medium">
              {isLatest ? 'Сейчас' : formatSnapshotTickLabel(selected.key)}
            </span>
            <span className="text-muted-foreground text-xs tabular-nums">
              {formatCheckedAt(selected.asOf)}
            </span>
          </div>
          <Badge size="sm" variant={isLatest ? 'success' : 'outline'}>
            {isLatest ? 'Актуально' : 'Снимок'}
          </Badge>
        </div>

        <Slider
          value={[index]}
          min={0}
          max={max}
          step={1}
          disabled={ticks.length <= 1}
          onValueChange={handleSlider}
          aria-label="Снимок проверок на дату"
        />

        <div className="min-w-0 overflow-x-auto">
          <Timeline
            orientation="horizontal"
            value={index + 1}
            onValueChange={(step) => onIndexChange(Math.max(0, step - 1))}
            className="min-w-max"
          >
            {ticks.map((tick, tickIndex) => {
              const showLabel =
                ticks.length <= 8 ||
                tickIndex === 0 ||
                tickIndex === lastIndex ||
                tickIndex === index
              return (
                <TimelineItem
                  key={tick.key}
                  step={tickIndex + 1}
                  className="cursor-pointer"
                  onClick={() => onIndexChange(tickIndex)}
                >
                  <TimelineHeader>
                    <TimelineSeparator />
                    <TimelineDate
                      className={cn(
                        'text-[11px] tabular-nums',
                        showLabel ? undefined : 'invisible',
                      )}
                    >
                      {formatSnapshotTickLabel(tick.key)}
                    </TimelineDate>
                    <TimelineIndicator className="size-2.5" />
                  </TimelineHeader>
                </TimelineItem>
              )
            })}
          </Timeline>
        </div>
      </FramePanel>
    </Frame>
  )
}
