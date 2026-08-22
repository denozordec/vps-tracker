import { type DataGridFeatures } from "@/components/reui/data-grid/data-grid"
import { DataGridColumnHeader } from "@/components/reui/data-grid/data-grid-column-header"
import { type ColumnDef } from "@tanstack/react-table"
import { format, isWeekend } from "date-fns"

import { cn } from "@cfdm/ui/lib/utils"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@cfdm/ui/components/avatar"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@cfdm/ui/components/tooltip"
import {
  EMPTY_ENTRY,
  formatMinutes,
  type EntryKind,
  type ITimeEntry,
  type ITimesheetRow,
} from "./data"
import { TrendingUp, TrendingDown } from "lucide-react"

const entryToneClass: Record<EntryKind, string> = {
  billable: "bg-emerald-500",
  internal: "bg-sky-500",
  support: "bg-amber-500",
  leave: "bg-zinc-400",
  empty: "bg-transparent",
}

const entryLabel: Record<EntryKind, string> = {
  billable: "Client",
  internal: "Internal",
  support: "Support",
  leave: "Leave",
  empty: "Open",
}

function getDayHeaderDateLabel(day: Date) {
  return format(day, "EEE, MMM d")
}

function getEntryHelperLabel(entry: ITimeEntry, weekend: boolean) {
  if (entry.minutes === 0) {
    return weekend ? "Off" : "Open"
  }

  return entryLabel[entry.kind]
}

function getEntryTooltipCopy(entry: ITimeEntry, weekend: boolean) {
  if (entry.minutes === 0) {
    return weekend
      ? "No weekend hours were logged for this day."
      : "No time has been logged for this work day yet."
  }

  return entry.note ?? `${entryLabel[entry.kind]} time entry.`
}

function PersonCell({ row }: { row: ITimesheetRow }) {
  const { person } = row

  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <div className="relative shrink-0">
        <Avatar className="size-8">
          {person.avatar ? (
            <AvatarImage src={person.avatar} alt={person.name} />
          ) : null}
          <AvatarFallback>{person.initials}</AvatarFallback>
        </Avatar>
      </div>

      <div className="flex min-w-0 flex-col leading-tight">
        <div className="text-foreground truncate text-sm font-medium">
          {person.name}
        </div>
        <div
          className="text-muted-foreground truncate pt-0.5 text-xs"
          title={person.role}
        >
          {person.role}
        </div>
      </div>
    </div>
  )
}

function DayCell({
  entry,
  weekend,
  dayLabel,
}: {
  entry: ITimeEntry
  weekend: boolean
  dayLabel: string
}) {
  const minutes = entry.minutes
  const progress =
    minutes > 0 ? Math.max(18, Math.min(100, (minutes / 480) * 100)) : 0
  const helperLabel = getEntryHelperLabel(entry, weekend)
  const tooltipCopy = getEntryTooltipCopy(entry, weekend)
  const ariaLabel =
    minutes > 0
      ? `${dayLabel}: ${formatMinutes(minutes)} logged as ${helperLabel.toLowerCase()}. ${tooltipCopy}`
      : `${dayLabel}: ${tooltipCopy}`

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            className="hover:bg-muted/60 focus-visible:ring-ring focus-visible:ring-offset-background inline-flex w-full cursor-pointer justify-center rounded-md px-1.5 py-1.5 text-left transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            aria-label={ariaLabel}
          />
        }
      >
        <div className="flex w-full min-w-[76px] flex-col items-center gap-1.5 text-center">
          <span
            className={cn(
              "text-sm leading-none tabular-nums",
              minutes > 0
                ? "text-foreground font-medium"
                : "text-muted-foreground",
              weekend && minutes === 0 && "opacity-80"
            )}
          >
            {minutes > 0 ? formatMinutes(minutes) : "-"}
          </span>

          <span className="bg-border block h-1 w-full max-w-[56px] overflow-hidden rounded-full">
            <span
              className={cn(
                "block h-full rounded-full",
                entryToneClass[entry.kind]
              )}
              style={{ width: `${progress}%` }}
            />
          </span>

          <span className="text-muted-foreground text-[11px] leading-none">
            {helperLabel}
          </span>
        </div>
      </TooltipTrigger>

      {/* Content */}
      <TooltipContent side="top" className="max-w-[220px] p-3">
        <div className="flex flex-col gap-1.5 text-left">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium">{dayLabel}</span>
            <span className="text-xs tabular-nums opacity-80">
              {minutes > 0 ? formatMinutes(minutes) : "-"}
            </span>
          </div>
          <p className="text-xs leading-relaxed opacity-80">{tooltipCopy}</p>
        </div>
      </TooltipContent>
    </Tooltip>
  )
}

function TotalCell({ row }: { row: ITimesheetRow }) {
  const toneClass =
    row.utilizationState === "on-target"
      ? "text-emerald-600"
      : row.utilizationState === "overtime"
        ? "text-sky-600"
        : "text-amber-600"
  const isPositiveTrend = row.utilizationState !== "under-target"

  return (
    <div className="flex flex-col items-end gap-1 text-right">
      <span className="text-foreground text-sm font-semibold tabular-nums">
        {formatMinutes(row.totalMinutes)}
      </span>
      <span
        className={cn(
          "inline-flex items-center gap-1 text-xs tabular-nums",
          toneClass
        )}
      >
        {isPositiveTrend ? (
          <TrendingUp className="size-3" aria-hidden="true" />
        ) : (
          <TrendingDown className="size-3" aria-hidden="true" />
        )}
        {row.targetCoverage}%
      </span>
    </div>
  )
}

export function createTimesheetColumns({
  visibleDays,
}: {
  visibleDays: Date[]
}): ColumnDef<DataGridFeatures, ITimesheetRow>[] {
  const dayColumns: ColumnDef<DataGridFeatures, ITimesheetRow>[] =
    visibleDays.map((day) => {
      const dayKey = format(day, "yyyy-MM-dd")
      const weekend = isWeekend(day)
      const dateLabel = getDayHeaderDateLabel(day)

      return {
        accessorFn: (row) => row.entries[dayKey]?.minutes ?? 0,
        id: dayKey,
        header: ({ column }) => (
          <DataGridColumnHeader
            title={dateLabel}
            column={column}
            className="w-full justify-center text-center text-xs font-normal"
          />
        ),
        cell: ({ row }) => (
          <DayCell
            entry={row.original.entries[dayKey] ?? EMPTY_ENTRY}
            weekend={weekend}
            dayLabel={format(day, "EEEE, MMM d")}
          />
        ),
        size: 112,
        enableSorting: false,
        enablePinning: false,
        meta: {
          headerClassName: "text-center!",
          cellClassName: "",
        },
      }
    })

  return [
    {
      accessorFn: (row) => row.person.name,
      id: "person",
      header: ({ column }) => (
        <DataGridColumnHeader title="People" column={column} />
      ),
      cell: ({ row }) => <PersonCell row={row.original} />,
      size: 240,
      enableSorting: false,
      enableHiding: false,
      enablePinning: false,
    },
    ...dayColumns,
    {
      accessorFn: (row) => row.totalMinutes,
      id: "total",
      header: ({ column }) => (
        <DataGridColumnHeader
          title="Total"
          column={column}
          className="w-full justify-end text-right"
        />
      ),
      cell: ({ row }) => <TotalCell row={row.original} />,
      size: 120,
      enableSorting: false,
      enablePinning: false,
      meta: {
        headerClassName: "text-right",
        cellClassName: "text-right",
      },
    },
  ]
}