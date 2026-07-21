import { AuditLogTimeline } from "./components/audit-log-timeline"

export function Page() {
  return (
    <div className="flex min-h-svh w-full items-start justify-center p-4 sm:p-8 md:p-12">
      <AuditLogTimeline />
    </div>
  )
}