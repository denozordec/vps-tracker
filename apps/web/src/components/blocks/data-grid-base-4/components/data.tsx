import { addDays, format, parseISO } from "date-fns"

export type TeamFilter =
  | "everyone"
  | "client-delivery"
  | "product"
  | "operations"
  | "support"

export type TrackedTimeFilter =
  | "any"
  | "under-target"
  | "on-target"
  | "overtime"

export type BillableStatusFilter =
  | "any"
  | "mostly-billable"
  | "mixed"
  | "internal-only"

export type EntryKind = "billable" | "internal" | "support" | "leave" | "empty"

export interface ITimeEntry {
  minutes: number
  kind: EntryKind
  note?: string
}

export interface ITimesheetPerson {
  id: string
  name: string
  initials: string
  avatar?: string
  role: string
  team: Exclude<TeamFilter, "everyone">
  teamLabel: string
  weeklyTargetMinutes: number
  entries: Record<string, ITimeEntry>
}

export interface ITimesheetRow {
  id: string
  person: ITimesheetPerson
  entries: Record<string, ITimeEntry>
  totalMinutes: number
  billableMinutes: number
  billablePercent: number
  activeDays: number
  varianceMinutes: number
  targetCoverage: number
  utilizationState: Exclude<TrackedTimeFilter, "any">
  billableState: Exclude<BillableStatusFilter, "any">
}

export const TEAM_OPTIONS: { value: TeamFilter; label: string }[] = [
  { value: "everyone", label: "People" },
  { value: "client-delivery", label: "Client delivery" },
  { value: "product", label: "Product" },
  { value: "operations", label: "Operations" },
  { value: "support", label: "Support" },
]

export const TRACKED_TIME_OPTIONS: {
  value: TrackedTimeFilter
  label: string
}[] = [
  { value: "any", label: "Tracked time" },
  { value: "under-target", label: "Under target" },
  { value: "on-target", label: "On target" },
  { value: "overtime", label: "Over target" },
]

export const BILLABLE_STATUS_OPTIONS: {
  value: BillableStatusFilter
  label: string
}[] = [
  { value: "any", label: "Billable status" },
  { value: "mostly-billable", label: "Mostly billable" },
  { value: "mixed", label: "Mixed" },
  { value: "internal-only", label: "Internal only" },
]

export const DEFAULT_WEEK_START = "2026-03-23"

export const EMPTY_ENTRY: ITimeEntry = {
  minutes: 0,
  kind: "empty",
}

function hours(
  value: number,
  kind: EntryKind = "billable",
  note?: string
): ITimeEntry {
  return {
    minutes: Math.round(value * 60),
    kind,
    note,
  }
}

function buildWeekEntries(weekStart: string, items: ITimeEntry[]) {
  const startDate = parseISO(weekStart)

  return Object.fromEntries(
    items.map((item, index) => [
      format(addDays(startDate, index), "yyyy-MM-dd"),
      item,
    ])
  )
}

function mergeEntries(...weeks: Array<Record<string, ITimeEntry>>) {
  return Object.assign({}, ...weeks)
}

export function formatMinutes(minutes: number) {
  if (minutes <= 0) return "0h"

  const hoursPart = Math.floor(minutes / 60)
  const minutesPart = minutes % 60

  if (minutesPart === 0) return `${hoursPart}h`

  return `${hoursPart}h ${minutesPart}m`
}

export const TIMESHEET_PEOPLE: ITimesheetPerson[] = [
  {
    id: "amara-ortiz",
    name: "Amara Ortiz",
    initials: "AO",
    avatar:
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=96&h=96&dpr=2&q=80",
    role: "Client delivery lead",
    team: "client-delivery",
    teamLabel: "Client delivery",
    weeklyTargetMinutes: 32 * 60,
    entries: mergeEntries(
      buildWeekEntries("2026-03-16", [
        hours(6, "billable", "Sprint planning with the Aurora account"),
        hours(6.5, "billable", "Client workshop and follow-up notes"),
        hours(5, "billable", "Delivery handoff edits"),
        hours(6, "billable", "Roadmap review with success team"),
        hours(4, "billable", "Executive recap deck"),
        EMPTY_ENTRY,
        EMPTY_ENTRY,
      ]),
      buildWeekEntries("2026-03-23", [
        hours(6.5, "billable", "Migration kickoff with Atlas Health"),
        hours(5.5, "internal", "Weekly staffing and margin review"),
        hours(7, "billable", "Pilot implementation sync"),
        hours(6, "billable", "Partner escalation planning"),
        hours(4.5, "billable", "Renewal prep"),
        EMPTY_ENTRY,
        EMPTY_ENTRY,
      ]),
      buildWeekEntries("2026-03-30", [
        hours(7, "billable", "Client leadership review"),
        hours(6.5, "billable", "Design QA handoff"),
        hours(6.5, "billable", "Retention plan workshop"),
        hours(6, "billable", "Launch review"),
        hours(5, "billable", "Weekly closeout"),
        EMPTY_ENTRY,
        EMPTY_ENTRY,
      ])
    ),
  },
  {
    id: "theo-mercer",
    name: "Theo Mercer",
    initials: "TM",
    avatar:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=96&h=96&dpr=2&q=80",
    role: "Platform engineer",
    team: "product",
    teamLabel: "Product",
    weeklyTargetMinutes: 40 * 60,
    entries: mergeEntries(
      buildWeekEntries("2026-03-16", [
        hours(8, "billable", "Registry licensing rollout"),
        hours(8, "billable", "Private install token support"),
        hours(7.5, "internal", "Infra refactor"),
        hours(8, "billable", "Partner sandbox fixes"),
        hours(6.5, "billable", "Observability cleanup"),
        EMPTY_ENTRY,
        EMPTY_ENTRY,
      ]),
      buildWeekEntries("2026-03-23", [
        hours(8, "billable", "Gateway failover validation"),
        hours(8, "billable", "Webhook retries"),
        hours(7.5, "billable", "Tenant sync fixes"),
        hours(8, "billable", "SSO edge cases"),
        hours(8, "billable", "Metrics rollout"),
        EMPTY_ENTRY,
        EMPTY_ENTRY,
      ]),
      buildWeekEntries("2026-03-30", [
        hours(8, "billable", "Multi-region smoke tests"),
        hours(8, "billable", "Registry cache hardening"),
        hours(8, "billable", "Usage ledger fixes"),
        hours(7.5, "billable", "Provisioning automation"),
        hours(8, "billable", "Ops docs"),
        EMPTY_ENTRY,
        hours(2, "internal", "Weekend incident follow-up"),
      ])
    ),
  },
  {
    id: "lena-hoffman",
    name: "Lena Hoffman",
    initials: "LH",
    avatar:
      "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=96&h=96&dpr=2&q=80",
    role: "Content systems editor",
    team: "operations",
    teamLabel: "Operations",
    weeklyTargetMinutes: 30 * 60,
    entries: mergeEntries(
      buildWeekEntries("2026-03-16", [
        hours(4, "internal", "Pattern taxonomy review"),
        hours(4.5, "internal", "Docs cleanup"),
        hours(5, "billable", "Client knowledge base rewrite"),
        hours(5, "internal", "Release notes"),
        hours(4, "billable", "Customer enablement assets"),
        EMPTY_ENTRY,
        EMPTY_ENTRY,
      ]),
      buildWeekEntries("2026-03-23", [
        hours(5, "internal", "Publishing QA"),
        hours(4.5, "billable", "Implementation guide updates"),
        hours(5, "internal", "Docs audit"),
        hours(3.5, "billable", "Admin walkthrough copy"),
        hours(4, "billable", "Email setup checklist"),
        EMPTY_ENTRY,
        EMPTY_ENTRY,
      ]),
      buildWeekEntries("2026-03-30", [
        hours(6, "billable", "Playbook rewrite"),
        hours(5.5, "internal", "Navigation audit"),
        hours(5, "internal", "New registry docs"),
        hours(4.5, "billable", "Workspace onboarding copy"),
        hours(4, "billable", "Support macros"),
        EMPTY_ENTRY,
        EMPTY_ENTRY,
      ])
    ),
  },
  {
    id: "iris-calder",
    name: "Iris Calder",
    initials: "IC",
    avatar:
      "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=96&h=96&dpr=2&q=80",
    role: "Design systems lead",
    team: "product",
    teamLabel: "Product",
    weeklyTargetMinutes: 32 * 60,
    entries: mergeEntries(
      buildWeekEntries("2026-03-16", [
        hours(6, "billable", "Dashboard refinements"),
        hours(6, "billable", "Billing table polish"),
        hours(6.5, "billable", "Settings review"),
        hours(5.5, "internal", "Library maintenance"),
        hours(4, "billable", "Handoff QA"),
        EMPTY_ENTRY,
        EMPTY_ENTRY,
      ]),
      buildWeekEntries("2026-03-23", [
        hours(6, "billable", "Timesheet explorations"),
        hours(6.5, "billable", "Usage analytics QA"),
        hours(6, "internal", "Pattern inventory"),
        hours(6.5, "billable", "Workspace theming"),
        hours(4, "billable", "Review fixes"),
        EMPTY_ENTRY,
        EMPTY_ENTRY,
      ]),
      buildWeekEntries("2026-03-30", [
        hours(6.5, "billable", "Sidebar migration"),
        hours(7, "billable", "Table density pass"),
        hours(6.5, "billable", "Forms package polish"),
        hours(6.5, "billable", "Release candidate QA"),
        hours(4.5, "billable", "Documentation review"),
        EMPTY_ENTRY,
        EMPTY_ENTRY,
      ])
    ),
  },
  {
    id: "samir-vale",
    name: "Samir Vale",
    initials: "SV",
    avatar:
      "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=96&h=96&dpr=2&q=80",
    role: "Partner success manager",
    team: "support",
    teamLabel: "Support",
    weeklyTargetMinutes: 35 * 60,
    entries: mergeEntries(
      buildWeekEntries("2026-03-16", [
        hours(7, "support", "High-touch client office hours"),
        hours(7, "support", "Renewal planning"),
        hours(6, "billable", "Implementation steering"),
        hours(7, "support", "Escalation review"),
        hours(6.5, "billable", "Adoption workshop"),
        EMPTY_ENTRY,
        EMPTY_ENTRY,
      ]),
      buildWeekEntries("2026-03-23", [
        hours(7, "support", "Go-live triage"),
        hours(7.5, "support", "Partner QBR prep"),
        hours(6.5, "billable", "Migration playbook review"),
        hours(8, "billable", "Expansion scoping"),
        hours(7, "support", "Weekly care plan"),
        EMPTY_ENTRY,
        EMPTY_ENTRY,
      ]),
      buildWeekEntries("2026-03-30", [
        hours(8, "support", "Enterprise rollout watch"),
        hours(7.5, "support", "Escalation retro"),
        hours(7, "billable", "Success handoff"),
        hours(7.5, "billable", "Client roadmap recap"),
        hours(7, "support", "Support coverage"),
        EMPTY_ENTRY,
        EMPTY_ENTRY,
      ])
    ),
  },
  {
    id: "nina-flores",
    name: "Nina Flores",
    initials: "NF",
    avatar:
      "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=96&h=96&dpr=2&q=80",
    role: "Launch producer",
    team: "client-delivery",
    teamLabel: "Client delivery",
    weeklyTargetMinutes: 28 * 60,
    entries: mergeEntries(
      buildWeekEntries("2026-03-16", [
        hours(5, "billable", "Client kickoff logistics"),
        hours(4.5, "billable", "Launch checklist review"),
        hours(5, "billable", "Support routing"),
        hours(4.5, "internal", "Team planning"),
        hours(3.5, "billable", "Go-live notes"),
        EMPTY_ENTRY,
        EMPTY_ENTRY,
      ]),
      buildWeekEntries("2026-03-23", [
        hours(5, "billable", "Workspace provisioning"),
        hours(5.5, "billable", "Rollout communications"),
        hours(5.5, "billable", "Checklist QA"),
        hours(4, "internal", "Process retro"),
        hours(4, "billable", "Launch follow-up"),
        EMPTY_ENTRY,
        EMPTY_ENTRY,
      ]),
      buildWeekEntries("2026-03-30", [
        hours(5.5, "billable", "Calendar + onboarding flow"),
        hours(5.5, "billable", "Billing handoff"),
        hours(6, "billable", "Activation reporting"),
        hours(4.5, "internal", "Ops planning"),
        hours(4, "billable", "Weekly close"),
        EMPTY_ENTRY,
        EMPTY_ENTRY,
      ])
    ),
  },
  {
    id: "owen-hart",
    name: "Owen Hart",
    initials: "OH",
    avatar:
      "https://images.unsplash.com/photo-1504593811423-6dd665756598?w=96&h=96&dpr=2&q=80",
    role: "QA automation engineer",
    team: "product",
    teamLabel: "Product",
    weeklyTargetMinutes: 40 * 60,
    entries: mergeEntries(
      buildWeekEntries("2026-03-16", [
        hours(8, "billable", "Regression pack"),
        hours(8, "billable", "Smoke tests"),
        hours(7, "billable", "Accessibility fixes"),
        hours(7.5, "support", "Release support"),
        hours(6, "billable", "Cross-browser QA"),
        EMPTY_ENTRY,
        EMPTY_ENTRY,
      ]),
      buildWeekEntries("2026-03-23", [
        hours(8, "billable", "Release candidate QA"),
        hours(8, "billable", "Import workflow pass"),
        hours(8, "billable", "Nested table checks"),
        hours(6, "support", "Launch support"),
        hours(5, "billable", "Timesheet regressions"),
        hours(2, "support", "Weekend support"),
        EMPTY_ENTRY,
      ]),
      buildWeekEntries("2026-03-30", [
        hours(8, "billable", "Billing QA"),
        hours(8, "billable", "Seat management checks"),
        hours(7.5, "billable", "Advanced filters"),
        hours(8, "billable", "Regression triage"),
        hours(7, "billable", "Accessibility sweep"),
        EMPTY_ENTRY,
        EMPTY_ENTRY,
      ])
    ),
  },
  {
    id: "cleo-warner",
    name: "Cleo Warner",
    initials: "CW",
    avatar:
      "https://images.unsplash.com/photo-1485893086445-ed75865251e0?w=96&h=96&dpr=2&q=80",
    role: "Brand editor",
    team: "operations",
    teamLabel: "Operations",
    weeklyTargetMinutes: 26 * 60,
    entries: mergeEntries(
      buildWeekEntries("2026-03-16", [
        hours(4, "internal", "Voice and tone QA"),
        hours(4.5, "internal", "Landing copy reviews"),
        hours(4, "internal", "Release notes"),
        hours(3.5, "billable", "Case study edits"),
        hours(4, "billable", "Partner launch copy"),
        EMPTY_ENTRY,
        EMPTY_ENTRY,
      ]),
      buildWeekEntries("2026-03-23", [
        hours(4.5, "internal", "Meta description pass"),
        hours(5, "internal", "Copy QA"),
        hours(4, "billable", "Customer stories"),
        hours(3.5, "billable", "Support snippets"),
        hours(4, "internal", "Release copy"),
        EMPTY_ENTRY,
        EMPTY_ENTRY,
      ]),
      buildWeekEntries("2026-03-30", [
        hours(5, "internal", "Brand polish"),
        hours(5, "billable", "Launch assets"),
        hours(4.5, "internal", "Publishing queue"),
        hours(4, "billable", "Email copy"),
        hours(4, "billable", "Closeout edits"),
        EMPTY_ENTRY,
        EMPTY_ENTRY,
      ])
    ),
  },
  {
    id: "jules-park",
    name: "Jules Park",
    initials: "JP",
    avatar:
      "https://images.unsplash.com/photo-1620075225255-8c2051b6c015?w=96&h=96&dpr=2&q=80",
    role: "Revenue operations analyst",
    team: "operations",
    teamLabel: "Operations",
    weeklyTargetMinutes: 20 * 60,
    entries: mergeEntries(
      buildWeekEntries("2026-03-16", [
        hours(3.5, "internal", "Forecast model updates"),
        hours(4, "billable", "Pricing QA"),
        hours(4, "internal", "Usage audit"),
        hours(3, "billable", "Renewal scorecard"),
        hours(3, "internal", "Pipeline review"),
        EMPTY_ENTRY,
        EMPTY_ENTRY,
      ]),
      buildWeekEntries("2026-03-23", [
        hours(4, "internal", "ARR reconciliation"),
        hours(4.5, "billable", "Expansion model"),
        hours(3.5, "billable", "Usage reporting"),
        hours(3, "internal", "Margin review"),
        hours(3, "billable", "Team closeout"),
        EMPTY_ENTRY,
        EMPTY_ENTRY,
      ]),
      buildWeekEntries("2026-03-30", [
        hours(4, "internal", "Pipeline hygiene"),
        hours(4.5, "billable", "Budget forecast"),
        hours(4, "internal", "Seat utilization audit"),
        hours(3.5, "billable", "MRR roll-up"),
        hours(3, "internal", "Planning prep"),
        EMPTY_ENTRY,
        EMPTY_ENTRY,
      ])
    ),
  },
]