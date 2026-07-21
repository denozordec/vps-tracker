import { HistoryIcon, TableIcon } from 'lucide-react'

import { ToggleGroup, ToggleGroupItem } from '@cfdm/ui/components/toggle-group'

export type AuditViewMode = 'timeline' | 'table'

interface AuditViewToggleProps {
  view: AuditViewMode
  onViewChange: (view: AuditViewMode) => void
}

export function AuditViewToggle({ view, onViewChange }: AuditViewToggleProps) {
  return (
    <ToggleGroup
      variant="outline"
      size="sm"
      spacing={0}
      value={[view]}
      onValueChange={(next) => {
        const selected = next[0]
        if (selected === 'timeline' || selected === 'table') onViewChange(selected)
      }}
      aria-label="Вид журнала"
    >
      <ToggleGroupItem value="timeline" aria-label="Лента">
        <HistoryIcon data-icon="inline-start" />
        Лента
      </ToggleGroupItem>
      <ToggleGroupItem value="table" aria-label="Таблица">
        <TableIcon data-icon="inline-start" />
        Таблица
      </ToggleGroupItem>
    </ToggleGroup>
  )
}
