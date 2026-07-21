import { formatDiffValue, diffFieldEntries } from '@/components/domain/audit-labels'

interface AuditDiffProps {
  diff: Record<string, unknown> | null | undefined
  className?: string
}

/** Поля diff как список ключ → значение (не raw JSON). */
export function AuditDiff({ diff, className }: AuditDiffProps) {
  const entries = diffFieldEntries(diff)
  if (entries.length === 0) {
    return <p className="text-muted-foreground text-xs">Нет деталей изменений</p>
  }

  return (
    <dl className={className ?? 'grid grid-cols-1 gap-2.5 sm:grid-cols-2'}>
      {entries.map(([key, value]) => (
        <div key={key} className="flex min-w-0 flex-col gap-0.5">
          <dt className="text-muted-foreground font-mono text-xs">{key}</dt>
          <dd className="text-foreground min-w-0 truncate text-sm font-medium" title={formatDiffValue(value)}>
            {formatDiffValue(value)}
          </dd>
        </div>
      ))}
    </dl>
  )
}
