import type { BadgeProps } from "@/components/reui/badge"
import { CircleCheckIcon, TriangleAlertIcon, ArrowLeftRightIcon, MailIcon, ShieldCheckIcon, UsersIcon, RefreshCwIcon, LogOutIcon, KeyRoundIcon, DatabaseIcon } from "lucide-react"

// ── Audit log world (Acme Cloud workspace) ──
// Severity drives the timeline indicator + the inline severity badge. Event
// type drives the filter chips. Each event carries an actor (avatar + email +
// IP), a target, and an expandable detail block (session id, reason).

export type EventSeverity = "info" | "notice" | "critical"

export type EventType = "Auth" | "Roles" | "SSO/SCIM" | "Sessions" | "API"

export type AuditActor = {
  name: string
  email: string
  avatar: string
  initials: string
}

export type AuditEvent = {
  id: string
  ref: string
  type: EventType
  action: string
  label: string
  target: string
  severity: EventSeverity
  time: string
  actor: AuditActor
  ip: string
  location: string
  icon: React.ReactNode
  detail: { sessionId: string; reason: string }
}

export type AuditDay = {
  id: number
  date: string
  events: AuditEvent[]
}

export type FilterOption = { value: EventType | "All"; label: string }

export type RangeOption = { value: string; label: string }

// ── Filter chips (event-type) ──
export const FILTER_OPTIONS: FilterOption[] = [
  { value: "All", label: "All" },
  { value: "Auth", label: "Auth" },
  { value: "Roles", label: "Roles" },
  { value: "SSO/SCIM", label: "SSO/SCIM" },
  { value: "Sessions", label: "Sessions" },
  { value: "API", label: "API" },
]

// ── Date-range select ──
export const RANGE_OPTIONS: RangeOption[] = [
  { value: "24h", label: "Last 24 hours" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
]

// ── Severity → badge variant + indicator dot ──
export const severityVariant: Record<EventSeverity, BadgeProps["variant"]> = {
  info: "success-outline",
  notice: "warning-outline",
  critical: "destructive-outline",
}

export const severityLabel: Record<EventSeverity, string> = {
  info: "Info",
  notice: "Notice",
  critical: "Critical",
}

export const severityDotClass: Record<EventSeverity, string> = {
  info: "bg-success",
  notice: "bg-warning",
  critical: "bg-destructive",
}

const MIRA: AuditActor = {
  name: "Mira Stone",
  email: "mira.stone@acmecloud.com",
  avatar:
    "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=96&h=96&dpr=2&q=80",
  initials: "MS",
}
const LEO: AuditActor = {
  name: "Leo Grant",
  email: "leo.grant@acmecloud.com",
  avatar:
    "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=96&h=96&dpr=2&q=80",
  initials: "LG",
}
const SANA: AuditActor = {
  name: "Sana Qureshi",
  email: "sana.qureshi@acmecloud.com",
  avatar:
    "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=96&h=96&dpr=2&q=80",
  initials: "SQ",
}
const SARAH: AuditActor = {
  name: "Sarah Chen",
  email: "sarah.chen@acmecloud.com",
  avatar:
    "https://images.unsplash.com/photo-1519699047748-de8e457a634e?w=96&h=96&dpr=2&q=80",
  initials: "SC",
}
const DAVID: AuditActor = {
  name: "David Kim",
  email: "david.kim@acmecloud.com",
  avatar:
    "https://images.unsplash.com/photo-1607990281513-2c110a25bd8c?w=96&h=96&dpr=2&q=80",
  initials: "DK",
}
const KENJI: AuditActor = {
  name: "Kenji Tan",
  email: "kenji.tan@acmecloud.com",
  avatar:
    "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=96&h=96&dpr=2&q=80",
  initials: "KT",
}
const OMAR: AuditActor = {
  name: "Omar Haddad",
  email: "omar.haddad@acmecloud.com",
  avatar:
    "https://images.unsplash.com/photo-1507591064344-4c6ce005b128?w=96&h=96&dpr=2&q=80",
  initials: "OH",
}
const NORA: AuditActor = {
  name: "Nora Vale",
  email: "nora.vale@acmecloud.com",
  avatar:
    "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=96&h=96&dpr=2&q=80",
  initials: "NV",
}

const authIcon = (
  <CircleCheckIcon className="size-3.5" aria-hidden="true" />
)
const authFailIcon = (
  <TriangleAlertIcon className="size-3.5" aria-hidden="true" />
)
const roleIcon = (
  <ArrowLeftRightIcon className="size-3.5" aria-hidden="true" />
)
const inviteIcon = (
  <MailIcon className="size-3.5" aria-hidden="true" />
)
const ssoIcon = (
  <ShieldCheckIcon className="size-3.5" aria-hidden="true" />
)
const scimIcon = (
  <UsersIcon className="size-3.5" aria-hidden="true" />
)
const mfaIcon = (
  <RefreshCwIcon className="size-3.5" aria-hidden="true" />
)
const sessionIcon = (
  <LogOutIcon className="size-3.5" aria-hidden="true" />
)
const apiIcon = (
  <KeyRoundIcon className="size-3.5" aria-hidden="true" />
)
const exportIcon = (
  <DatabaseIcon className="size-3.5" aria-hidden="true" />
)

// ── Audit events grouped by day (newest first) ──
export const AUDIT_DAYS: AuditDay[] = [
  {
    id: 1,
    date: "Today, Jun 17",
    events: [
      {
        id: "e1",
        ref: "evt_9f3a21c8",
        type: "Auth",
        action: "Login failed",
        label: "Password rejected",
        target: "kenji.tan@acmecloud.com",
        severity: "critical",
        time: "2:14 PM",
        actor: KENJI,
        ip: "192.0.2.51",
        location: "Berlin",
        icon: authFailIcon,
        detail: {
          sessionId: "sess_b71e0d44",
          reason: "3 failed attempts in 5 minutes, account temporarily locked",
        },
      },
      {
        id: "e2",
        ref: "evt_71b0a9d2",
        type: "Roles",
        action: "Role changed",
        label: "Member to Admin",
        target: "Sana Qureshi",
        severity: "notice",
        time: "1:02 PM",
        actor: LEO,
        ip: "192.0.2.14",
        location: "San Francisco",
        icon: roleIcon,
        detail: {
          sessionId: "sess_c98a2f10",
          reason: "Promotion approved by Mira Stone, scope raised to Write",
        },
      },
      {
        id: "e3",
        ref: "evt_4c2d80ae",
        type: "Sessions",
        action: "Session revoked",
        label: "Chrome on Windows",
        target: "David Kim",
        severity: "notice",
        time: "11:48 AM",
        actor: SARAH,
        ip: "192.0.2.22",
        location: "Seattle",
        icon: sessionIcon,
        detail: {
          sessionId: "sess_5d1c6b09",
          reason: "Revoked from a stale device, last active 14 days ago",
        },
      },
      {
        id: "e4",
        ref: "evt_2a6f13bb",
        type: "Auth",
        action: "Login success",
        label: "SSO via Okta",
        target: "mira.stone@acmecloud.com",
        severity: "info",
        time: "9:05 AM",
        actor: MIRA,
        ip: "192.0.2.14",
        location: "San Francisco",
        icon: authIcon,
        detail: {
          sessionId: "sess_a02d7e58",
          reason: "Passkey verified, session valid for 12 hours",
        },
      },
    ],
  },
  {
    id: 2,
    date: "Yesterday, Jun 16",
    events: [
      {
        id: "e5",
        ref: "evt_88e1c5f0",
        type: "API",
        action: "API key created",
        label: "Production, ci-deploy",
        target: "key_3f9a...c712",
        severity: "notice",
        time: "6:21 PM",
        actor: DAVID,
        ip: "192.0.2.31",
        location: "Seattle",
        icon: apiIcon,
        detail: {
          sessionId: "sess_7b40e1aa",
          reason: "Scopes: deployments:write, logs:read, expires in 90 days",
        },
      },
      {
        id: "e6",
        ref: "evt_15d7a3e9",
        type: "SSO/SCIM",
        action: "SSO config changed",
        label: "Okta to Microsoft Entra ID",
        target: "Acme Cloud workspace",
        severity: "critical",
        time: "4:37 PM",
        actor: MIRA,
        ip: "192.0.2.14",
        location: "San Francisco",
        icon: ssoIcon,
        detail: {
          sessionId: "sess_e21f9c03",
          reason: "Default identity provider switched, 68 members affected",
        },
      },
      {
        id: "e7",
        ref: "evt_6b094d27",
        type: "SSO/SCIM",
        action: "SCIM provision",
        label: "4 members imported",
        target: "Engineering team",
        severity: "info",
        time: "4:30 PM",
        actor: LEO,
        ip: "192.0.2.14",
        location: "San Francisco",
        icon: scimIcon,
        detail: {
          sessionId: "sess_d4c7b210",
          reason: "JIT provisioning from Entra ID, 80 of 80 seats reconciled",
        },
      },
      {
        id: "e8",
        ref: "evt_33a8e0c1",
        type: "Auth",
        action: "MFA reset",
        label: "Authenticator re-enrolled",
        target: "Omar Haddad",
        severity: "notice",
        time: "2:10 PM",
        actor: SARAH,
        ip: "192.0.2.22",
        location: "Seattle",
        icon: mfaIcon,
        detail: {
          sessionId: "sess_9f0b2d6e",
          reason: "Lost device reported, TOTP factor reset by admin",
        },
      },
      {
        id: "e9",
        ref: "evt_07c4f2a5",
        type: "Roles",
        action: "Member invited",
        label: "Guest, Support Agent",
        target: "nora.vale@acmecloud.com",
        severity: "info",
        time: "10:55 AM",
        actor: MIRA,
        ip: "192.0.2.14",
        location: "San Francisco",
        icon: inviteIcon,
        detail: {
          sessionId: "sess_1ab39e7c",
          reason: "Invite expires in 7 days, scope set to Read",
        },
      },
    ],
  },
  {
    id: 3,
    date: "Jun 15",
    events: [
      {
        id: "e10",
        ref: "evt_5e2b9114",
        type: "API",
        action: "Data export",
        label: "Audit log, CSV",
        target: "8,420 events",
        severity: "notice",
        time: "5:42 PM",
        actor: OMAR,
        ip: "192.0.2.40",
        location: "Toronto",
        icon: exportIcon,
        detail: {
          sessionId: "sess_4c8d1f93",
          reason: "Export covered 90 days, download link valid for 24 hours",
        },
      },
      {
        id: "e11",
        ref: "evt_9012ad6f",
        type: "Sessions",
        action: "Session revoked",
        label: "Safari on iOS",
        target: "Nora Vale",
        severity: "info",
        time: "3:18 PM",
        actor: NORA,
        ip: "192.0.2.47",
        location: "Austin",
        icon: sessionIcon,
        detail: {
          sessionId: "sess_2f7a0c61",
          reason: "Signed out of all other devices from account settings",
        },
      },
      {
        id: "e12",
        ref: "evt_a4f60b38",
        type: "Auth",
        action: "Login success",
        label: "Password, 2FA passed",
        target: "sana.qureshi@acmecloud.com",
        severity: "info",
        time: "8:47 AM",
        actor: SANA,
        ip: "192.0.2.33",
        location: "London",
        icon: authIcon,
        detail: {
          sessionId: "sess_88be4d02",
          reason: "Security key verified, new device added to trusted list",
        },
      },
    ],
  },
]