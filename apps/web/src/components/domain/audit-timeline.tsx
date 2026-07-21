import { useMemo, useState } from 'react'
import { Link } from '@tanstack/react-router'
import {
  ChevronRightIcon,
  HistoryIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
  UserRoundIcon,
} from 'lucide-react'

import { Badge } from '@/components/reui/badge'
import { Frame, FrameHeader, FramePanel } from '@/components/reui/frame'
import {
  Timeline,
  TimelineContent,
  TimelineHeader,
  TimelineIndicator,
  TimelineItem,
  TimelineSeparator,
  TimelineTitle,
} from '@/components/reui/timeline'
import { AuditDiff } from '@/components/domain/audit-diff'
import {
  auditActionBadgeVariant,
  auditActionLabel,
  auditEntityLabel,
  diffFieldEntries,
} from '@/components/domain/audit-labels'
import { cn } from '@cfdm/ui/lib/utils'
import { Button } from '@cfdm/ui/components/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@cfdm/ui/components/collapsible'

export interface AuditRow {
  id: string
  entity: string
  entityId: string
  action: string
  diff: Record<string, unknown> | null
  actorUserId?: string | null
  createdAt: string
}

interface AuditTimelineProps {
  rows: AuditRow[]
}

function actionIcon(action: string) {
  if (action === 'create') return <PlusIcon aria-hidden />
  if (action === 'delete') return <Trash2Icon aria-hidden />
  if (action === 'update') return <PencilIcon aria-hidden />
  return <HistoryIcon aria-hidden />
}

function dayKey(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function dayLabel(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function timeLabel(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function EntityIdLink({ entity, entityId }: { entity: string; entityId: string }) {
  if (entity === 'vps') {
    return (
      <Button
        variant="link"
        className="h-auto p-0 font-mono text-xs"
        render={<Link to="/vps/$vpsId" params={{ vpsId: entityId }} />}
      >
        {entityId}
      </Button>
    )
  }
  return <span className="font-mono text-xs">{entityId}</span>
}

function EventRow({
  row,
  step,
  isLast,
  defaultOpen,
}: {
  row: AuditRow
  step: number
  isLast: boolean
  defaultOpen: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  const fieldCount = diffFieldEntries(row.diff).length
  const actor = row.actorUserId?.trim() || 'система'

  return (
    <TimelineItem step={step} className={cn('ms-10', isLast ? 'pb-0' : 'pb-6')}>
      <TimelineHeader className="flex min-w-0 items-center justify-between gap-2.5">
        <TimelineSeparator className="bg-border! group-data-[orientation=vertical]/timeline:-left-7 group-data-[orientation=vertical]/timeline:h-[calc(100%-1.5rem-0.5rem)] group-data-[orientation=vertical]/timeline:translate-y-7" />
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <TimelineTitle className="text-sm font-semibold">
            {auditActionLabel(row.action)}
          </TimelineTitle>
          <Badge variant={auditActionBadgeVariant(row.action)} size="sm">
            {auditEntityLabel(row.entity)}
          </Badge>
          <span className="text-muted-foreground text-xs tabular-nums">{timeLabel(row.createdAt)}</span>
        </div>
        <TimelineIndicator className="border-border bg-background text-muted-foreground flex size-6 items-center justify-center border shadow-xs group-data-[orientation=vertical]/timeline:-left-7 [&_svg]:size-3.5">
          {actionIcon(row.action)}
        </TimelineIndicator>
      </TimelineHeader>

      <TimelineContent className="mt-2">
        <Frame stacked dense spacing="sm">
          <Collapsible open={open} onOpenChange={setOpen} className="group/collapsible">
            <CollapsibleTrigger type="button" className="flex w-full" aria-label="Детали изменений">
              <FrameHeader className="flex grow flex-row items-center justify-between gap-2">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <UserRoundIcon className="text-muted-foreground size-3.5 shrink-0" aria-hidden />
                  <span className="text-muted-foreground truncate text-sm font-medium">{actor}</span>
                  <span className="text-muted-foreground text-xs">·</span>
                  <EntityIdLink entity={row.entity} entityId={row.entityId} />
                  {fieldCount > 0 ? (
                    <Badge variant="outline" size="xs">
                      {fieldCount} {fieldCount === 1 ? 'поле' : 'полей'}
                    </Badge>
                  ) : null}
                </div>
                <ChevronRightIcon
                  className="text-muted-foreground size-4 shrink-0 transition-transform duration-200 group-data-open/collapsible:rotate-90"
                  aria-hidden
                />
              </FrameHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <FramePanel className="flex flex-col gap-3">
                <dl className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <dt className="text-muted-foreground text-xs">Сущность</dt>
                    <dd className="text-sm font-medium">{auditEntityLabel(row.entity)}</dd>
                  </div>
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <dt className="text-muted-foreground text-xs">ID</dt>
                    <dd className="min-w-0">
                      <EntityIdLink entity={row.entity} entityId={row.entityId} />
                    </dd>
                  </div>
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <dt className="text-muted-foreground text-xs">Актор</dt>
                    <dd className="truncate text-sm font-medium">{actor}</dd>
                  </div>
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <dt className="text-muted-foreground text-xs">Время</dt>
                    <dd className="text-sm font-medium tabular-nums">
                      {new Date(row.createdAt).toLocaleString('ru-RU')}
                    </dd>
                  </div>
                </dl>
                <div className="border-border flex flex-col gap-2 border-t pt-2.5">
                  <span className="text-muted-foreground text-xs font-medium">Изменения</span>
                  <AuditDiff diff={row.diff} />
                </div>
              </FramePanel>
            </CollapsibleContent>
          </Collapsible>
        </Frame>
      </TimelineContent>
    </TimelineItem>
  )
}

/** Day-grouped audit timeline — DNA solution-users-6. */
export function AuditTimeline({ rows }: AuditTimelineProps) {
  const days = useMemo(() => {
    const map = new Map<string, { key: string; label: string; events: AuditRow[] }>()
    for (const row of rows) {
      const key = dayKey(row.createdAt)
      const existing = map.get(key)
      if (existing) {
        existing.events.push(row)
      } else {
        map.set(key, { key, label: dayLabel(row.createdAt), events: [row] })
      }
    }
    return Array.from(map.values())
  }, [rows])

  return (
    <div className="flex flex-col gap-8">
      {days.map((day, dayIndex) => (
        <div key={day.key} className="flex flex-col gap-4">
          <h2 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
            {day.label}
          </h2>
          <Timeline>
            {day.events.map((event, index) => (
              <EventRow
                key={event.id}
                row={event}
                step={index + 1}
                isLast={index === day.events.length - 1}
                defaultOpen={dayIndex === 0 && index < 2}
              />
            ))}
          </Timeline>
        </div>
      ))}
    </div>
  )
}
