"use client"

import * as React from "react"
import { Badge } from "@/components/reui/badge"
import {
  Frame,
  FrameHeader,
  FramePanel,
} from "@/components/reui/frame"
import {
  Timeline,
  TimelineContent,
  TimelineHeader,
  TimelineIndicator,
  TimelineItem,
  TimelineSeparator,
  TimelineTitle,
} from "@/components/reui/timeline"
import { toast } from "sonner"

import { cn } from "@cfdm/ui/lib/utils"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@cfdm/ui/components/avatar"
import { Button } from "@cfdm/ui/components/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@cfdm/ui/components/collapsible"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@cfdm/ui/components/empty"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@cfdm/ui/components/select"
import { Tabs, TabsList, TabsTrigger } from "@cfdm/ui/components/tabs"
import {
  AUDIT_DAYS,
  FILTER_OPTIONS,
  RANGE_OPTIONS,
  severityDotClass,
  severityLabel,
  severityVariant,
  type AuditEvent,
  type EventType,
} from "./data"
import { ChevronRightIcon, CopyIcon, CalendarIcon, DownloadIcon, FilterIcon } from "lucide-react"

const TOTAL_EVENTS = AUDIT_DAYS.reduce((sum, day) => sum + day.events.length, 0)

function copyValue(value: string) {
  if (typeof navigator !== "undefined" && navigator.clipboard) {
    void navigator.clipboard.writeText(value).catch(() => undefined)
  }
}

// ── Single audit event row (reuses timeline-1 Collapsible-in-Frame grammar) ──
function EventRow({
  event,
  isLast,
  step,
  defaultOpen,
}: {
  event: AuditEvent
  isLast: boolean
  step: number
  defaultOpen: boolean
}) {
  const [open, setOpen] = React.useState(defaultOpen)

  return (
    <TimelineItem step={step} className={cn("ms-10", isLast ? "pb-0" : "pb-6")}>
      <TimelineHeader className="flex min-w-0 items-center justify-between gap-2.5">
        <TimelineSeparator className="bg-border! group-data-[orientation=vertical]/timeline:-left-7 group-data-[orientation=vertical]/timeline:h-[calc(100%-1.5rem-0.5rem)] group-data-[orientation=vertical]/timeline:translate-y-7" />
        <div className="flex flex-wrap items-center gap-2">
          <TimelineTitle className="text-sm font-semibold">
            {event.action}
          </TimelineTitle>
          <Badge variant={severityVariant[event.severity]} className="gap-1.5">
            <span
              className={cn(
                "size-1.5 shrink-0 rounded-full",
                severityDotClass[event.severity]
              )}
              aria-hidden="true"
            />
            {severityLabel[event.severity]}
          </Badge>
          <span className="text-muted-foreground text-xs">{event.time}</span>
        </div>
        <TimelineIndicator className="border-border bg-background text-muted-foreground flex size-6 items-center justify-center border shadow-xs group-data-[orientation=vertical]/timeline:-left-7 [&_svg]:size-3.5">
          {event.icon}
        </TimelineIndicator>
      </TimelineHeader>

      <TimelineContent className="mt-2">
        <Frame stacked dense spacing="sm">
          <Collapsible
            open={open}
            onOpenChange={(nextOpen) => setOpen(nextOpen)}
            className="group/collapsible"
          >
            <CollapsibleTrigger
              type="button"
              className="flex w-full"
              aria-label={`Toggle ${event.action} details`}
            >
              <FrameHeader className="flex grow flex-row items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <Avatar className="size-5">
                    <AvatarImage
                      src={event.actor.avatar}
                      alt={event.actor.name}
                    />
                    <AvatarFallback className="text-[10px]">
                      {event.actor.initials}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-muted-foreground min-w-0 truncate text-sm font-medium">
                    {event.actor.name}, {event.label}
                  </span>
                </div>
                <ChevronRightIcon className="text-muted-foreground size-4 shrink-0 transition-transform duration-200 group-data-open/collapsible:rotate-90" aria-hidden="true" />
              </FrameHeader>
            </CollapsibleTrigger>

            <CollapsibleContent>
              <FramePanel className="space-y-3">
                <dl className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  <DetailRow label="Target">
                    <span className="text-foreground truncate font-medium">
                      {event.target}
                    </span>
                  </DetailRow>
                  <DetailRow label="Actor">
                    <span className="text-foreground truncate font-medium">
                      {event.actor.email}
                    </span>
                  </DetailRow>
                  <DetailRow label="Source IP">
                    <span className="text-foreground inline-flex min-w-0 items-center gap-2 font-medium tabular-nums">
                      <span className="truncate">{event.ip}</span>
                      <span className="text-muted-foreground truncate">
                        {event.location}
                      </span>
                    </span>
                  </DetailRow>
                  <DetailRow label="Session">
                    <span className="text-foreground truncate font-mono text-xs">
                      {event.detail.sessionId}
                    </span>
                  </DetailRow>
                </dl>

                <p className="text-muted-foreground text-xs leading-5">
                  {event.detail.reason}
                </p>

                <div className="flex flex-wrap items-center justify-between gap-2.5 border-t pt-2.5">
                  <Badge variant="outline" className="gap-1.5 font-mono">
                    {event.ref}
                  </Badge>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      copyValue(event.ref)
                      toast.success("Reference copied", {
                        description: `${event.ref} is on your clipboard.`,
                      })
                    }}
                  >
                    <CopyIcon className="opacity-60" aria-hidden="true" />
                    Copy reference
                  </Button>
                </div>
              </FramePanel>
            </CollapsibleContent>
          </Collapsible>
        </Frame>
      </TimelineContent>
    </TimelineItem>
  )
}

function DetailRow({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="flex min-w-0 items-center text-sm">{children}</dd>
    </div>
  )
}

export function AuditLogTimeline() {
  const [filter, setFilter] = React.useState<string[]>(["All"])
  const [range, setRange] = React.useState("24h")

  const activeFilter = (filter[0] ?? "All") as EventType | "All"

  const visibleDays = React.useMemo(() => {
    if (activeFilter === "All") return AUDIT_DAYS
    return AUDIT_DAYS.map((day) => ({
      ...day,
      events: day.events.filter((event) => event.type === activeFilter),
    })).filter((day) => day.events.length > 0)
  }, [activeFilter])

  const visibleCount = visibleDays.reduce(
    (sum, day) => sum + day.events.length,
    0
  )

  const handleExport = () => {
    toast.success("Export ready", {
      description: `${visibleCount} events queued as CSV. Link valid for 24 hours.`,
    })
  }

  return (
    <section
      className="mx-auto w-full max-w-2xl"
      aria-labelledby="audit-log-title"
    >
      {/* ── Content header (title + filter chips + range + export) ── */}
      <div className="mb-6 flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <h1
              id="audit-log-title"
              className="text-xl font-semibold tracking-tight"
            >
              Audit Log
            </h1>
            <p className="text-muted-foreground text-sm leading-5">
              {TOTAL_EVENTS} events in Acme Cloud workspace
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Select
              value={range}
              onValueChange={(value) => value && setRange(value)}
              items={RANGE_OPTIONS}
            >
              <SelectTrigger size="sm" className="w-40">
                <CalendarIcon className="text-muted-foreground size-4" aria-hidden="true" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end" alignItemWithTrigger={false}>
                <SelectGroup>
                  {RANGE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>

            <Button size="sm" type="button" onClick={handleExport}>
              <DownloadIcon aria-hidden="true" />
              <span className="hidden sm:block">Export CSV</span>
            </Button>
          </div>
        </div>

        <Tabs
          value={activeFilter}
          onValueChange={(value) => value && setFilter([value])}
        >
          <TabsList
            variant="line"
            aria-label="Filter by event type"
            className="h-10! w-full justify-start gap-6 overflow-x-auto border-b"
          >
            {FILTER_OPTIONS.map((option) => (
              <TabsTrigger
                key={option.value}
                value={option.value}
                className="px-1 text-sm after:-bottom-px!"
              >
                {option.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {visibleDays.length === 0 ? (
        <Empty className="min-h-[280px] border-0 bg-transparent">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FilterIcon aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle>No {activeFilter} events</EmptyTitle>
            <EmptyDescription>
              No {activeFilter} events in the last 24 hours. Try another type or
              widen the range.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button
              type="button"
              variant="outline"
              onClick={() => setFilter(["All"])}
            >
              Clear filter
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="space-y-8">
          {visibleDays.map((day) => (
            <div key={day.id} className="space-y-4">
              <h2 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                {day.date}
              </h2>
              <Timeline>
                {day.events.map((event, index) => (
                  <EventRow
                    key={event.id}
                    event={event}
                    step={index + 1}
                    isLast={index === day.events.length - 1}
                    defaultOpen={day.id === 1 && index < 2}
                  />
                ))}
              </Timeline>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}