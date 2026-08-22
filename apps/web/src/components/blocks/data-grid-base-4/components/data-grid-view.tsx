"use client"

import { useCallback, useMemo, useState } from "react"
import {
  DataGrid,
  dataGridFeatures,
} from "@/components/reui/data-grid/data-grid"
import { DataGridPagination } from "@/components/reui/data-grid/data-grid-pagination"
import { DataGridScrollArea } from "@/components/reui/data-grid/data-grid-scroll-area"
import { DataGridTable } from "@/components/reui/data-grid/data-grid-table"
import {
  Frame,
  FrameDescription,
  FrameFooter,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@/components/reui/frame"
import { useTable, type PaginationState } from "@tanstack/react-table"
import {
  addWeeks,
  eachDayOfInterval,
  endOfWeek,
  format,
  parseISO,
  startOfWeek,
} from "date-fns"

import { Button } from "@cfdm/ui/components/button"
import { ButtonGroup } from "@cfdm/ui/components/button-group"
import { Calendar } from "@cfdm/ui/components/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@cfdm/ui/components/popover"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@cfdm/ui/components/select"
import { Separator } from "@cfdm/ui/components/separator"
import { createTimesheetColumns } from "./columns"
import {
  BILLABLE_STATUS_OPTIONS,
  DEFAULT_WEEK_START,
  EMPTY_ENTRY,
  TEAM_OPTIONS,
  TIMESHEET_PEOPLE,
  TRACKED_TIME_OPTIONS,
  type BillableStatusFilter,
  type ITimesheetPerson,
  type ITimesheetRow,
  type TeamFilter,
  type TrackedTimeFilter,
} from "./data"
import { ChevronLeftIcon, CalendarIcon, ChevronRightIcon } from "lucide-react"

function normalizeWeekStart(date: Date) {
  return startOfWeek(date, { weekStartsOn: 1 })
}

function getDateKey(date: Date) {
  return format(date, "yyyy-MM-dd")
}

function getTrackedTimeState(
  totalMinutes: number,
  targetMinutes: number
): Exclude<TrackedTimeFilter, "any"> {
  if (targetMinutes <= 0) return "on-target"

  const ratio = totalMinutes / targetMinutes

  if (ratio > 1.08) return "overtime"
  if (ratio >= 0.85) return "on-target"
  return "under-target"
}

function getBillableState(
  totalMinutes: number,
  billableMinutes: number
): Exclude<BillableStatusFilter, "any"> {
  if (totalMinutes <= 0 || billableMinutes <= 0) return "internal-only"

  const ratio = billableMinutes / totalMinutes
  return ratio >= 0.75 ? "mostly-billable" : "mixed"
}

function createTimesheetRow(
  person: ITimesheetPerson,
  visibleDays: Date[]
): ITimesheetRow {
  const entries = Object.fromEntries(
    visibleDays.map((day) => {
      const key = getDateKey(day)
      return [key, person.entries[key] ?? EMPTY_ENTRY]
    })
  )

  const totalMinutes = Object.values(entries).reduce(
    (sum, entry) => sum + entry.minutes,
    0
  )

  const billableMinutes = Object.values(entries).reduce(
    (sum, entry) => sum + (entry.kind === "billable" ? entry.minutes : 0),
    0
  )

  const activeDays = Object.values(entries).filter(
    (entry) => entry.minutes > 0
  ).length

  const billablePercent =
    totalMinutes > 0 ? Math.round((billableMinutes / totalMinutes) * 100) : 0

  const varianceMinutes = totalMinutes - person.weeklyTargetMinutes

  const targetCoverage =
    person.weeklyTargetMinutes > 0
      ? Math.round((totalMinutes / person.weeklyTargetMinutes) * 100)
      : 0

  return {
    id: person.id,
    person,
    entries,
    totalMinutes,
    billableMinutes,
    billablePercent,
    activeDays,
    varianceMinutes,
    targetCoverage,
    utilizationState: getTrackedTimeState(
      totalMinutes,
      person.weeklyTargetMinutes
    ),
    billableState: getBillableState(totalMinutes, billableMinutes),
  }
}

function formatRangeLabel(days: Date[]) {
  if (days.length === 0) return ""

  const start = days[0]
  const end = days[days.length - 1]

  if (format(start, "MMM") === format(end, "MMM")) {
    return `${format(start, "MMM d")} - ${format(end, "d")}`
  }

  return `${format(start, "MMM d")} - ${format(end, "MMM d")}`
}

export function TimesheetGridView() {
  const [teamFilter, setTeamFilter] = useState<TeamFilter>("everyone")
  const [trackedTimeFilter, setTrackedTimeFilter] =
    useState<TrackedTimeFilter>("any")
  const [billableStatusFilter, setBillableStatusFilter] =
    useState<BillableStatusFilter>("any")
  const [weekStart, setWeekStart] = useState<Date>(
    normalizeWeekStart(parseISO(DEFAULT_WEEK_START))
  )
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 5,
  })

  const resetPagination = useCallback(() => {
    setPagination((current) =>
      current.pageIndex === 0 ? current : { ...current, pageIndex: 0 }
    )
  }, [])

  const weekDays = useMemo(
    () =>
      eachDayOfInterval({
        start: weekStart,
        end: endOfWeek(weekStart, { weekStartsOn: 1 }),
      }),
    [weekStart]
  )

  const visibleDays = weekDays

  const filteredRows = useMemo(() => {
    return TIMESHEET_PEOPLE.map((person) =>
      createTimesheetRow(person, visibleDays)
    )
      .filter((row) =>
        teamFilter === "everyone" ? true : row.person.team === teamFilter
      )
      .filter((row) =>
        trackedTimeFilter === "any"
          ? true
          : row.utilizationState === trackedTimeFilter
      )
      .filter((row) =>
        billableStatusFilter === "any"
          ? true
          : row.billableState === billableStatusFilter
      )
  }, [billableStatusFilter, teamFilter, trackedTimeFilter, visibleDays])

  const columns = useMemo(
    () => createTimesheetColumns({ visibleDays }),
    [visibleDays]
  )

  const table = useTable({
    features: dataGridFeatures,
    data: filteredRows,
    columns,
    getRowId: (row) => row.id,
    state: {
      pagination,
    },
    onPaginationChange: setPagination,
  })

  const handleWeekPick = useCallback(
    (date: Date | undefined) => {
      if (!date) return
      setWeekStart(normalizeWeekStart(date))
      resetPagination()
    },
    [resetPagination]
  )

  const shiftWeek = useCallback(
    (delta: number) => {
      setWeekStart((current) => addWeeks(current, delta))
      resetPagination()
    },
    [resetPagination]
  )

  const emptyMessage = "No timesheets match the current filters."

  return (
    <DataGrid
      table={table}
      recordCount={filteredRows.length}
      emptyMessage={emptyMessage}
      tableLayout={{
        cellBorder: true,
        columnsPinnable: false,
        dense: true,
      }}
      // customize: edge cells borrow the frame's own px token so the first and
      // last columns line up with the FrameHeader instead of the 8px cell default
      tableClassNames={{
        edgeCell:
          "first:ps-(--frame-panel-header-px) last:pe-(--frame-panel-header-px)",
      }}
    >
      <Frame dense className="w-full">
        <FrameHeader className="flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-px">
            <FrameTitle className="text-balance">Timesheets</FrameTitle>
            <FrameDescription className="text-xs text-pretty">
              Weekly team timesheets
            </FrameDescription>
          </div>

          <Button type="button" className="w-full sm:w-auto">
            New entry
          </Button>
        </FrameHeader>

        <FramePanel className="bg-card p-0! shadow-none!">
          {/* customize: px stays on the frame header token; py-2.5 gives the filter row more breathing room */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-(--frame-panel-header-px) py-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={teamFilter}
                onValueChange={(value) => {
                  setTeamFilter(value as TeamFilter)
                  resetPagination()
                }}
                items={TEAM_OPTIONS}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {TEAM_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>

              <Select
                value={trackedTimeFilter}
                onValueChange={(value) => {
                  setTrackedTimeFilter(value as TrackedTimeFilter)
                  resetPagination()
                }}
                items={TRACKED_TIME_OPTIONS}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {TRACKED_TIME_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>

              <Select
                value={billableStatusFilter}
                onValueChange={(value) => {
                  setBillableStatusFilter(value as BillableStatusFilter)
                  resetPagination()
                }}
                items={BILLABLE_STATUS_OPTIONS}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {BILLABLE_STATUS_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2">
              <ButtonGroup>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Previous week"
                  onClick={() => shiftWeek(-1)}
                >
                  <ChevronLeftIcon aria-hidden="true" />
                </Button>

                <Popover>
                  <PopoverTrigger
                    render={
                      <Button
                        type="button"
                        variant="outline"
                        className="w-[168px] justify-between font-normal tabular-nums"
                      >
                        <span className="truncate">
                          {formatRangeLabel(visibleDays)}
                        </span>
                        <CalendarIcon className="text-muted-foreground" aria-hidden="true" />
                      </Button>
                    }
                  />
                  <PopoverContent align="end" className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={weekStart}
                      onSelect={handleWeekPick}
                      className="rounded-lg"
                    />
                  </PopoverContent>
                </Popover>

                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Next week"
                  onClick={() => shiftWeek(1)}
                >
                  <ChevronRightIcon aria-hidden="true" />
                </Button>
              </ButtonGroup>
            </div>
          </div>

          <Separator />

          <DataGridScrollArea>
            <DataGridTable />
          </DataGridScrollArea>

          <Separator />

          <FrameFooter>
            <DataGridPagination />
          </FrameFooter>
        </FramePanel>
      </Frame>
    </DataGrid>
  )
}