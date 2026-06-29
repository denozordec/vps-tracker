import { useMemo } from 'react'
import { FolderKanbanIcon } from 'lucide-react'

import { Button } from '@cfdm/ui/components/button'
import { Checkbox } from '@cfdm/ui/components/checkbox'
import { Label } from '@cfdm/ui/components/label'
import { Popover, PopoverContent, PopoverTrigger } from '@cfdm/ui/components/popover'
import { SelectField } from '@/components/select-field'
import {
  ListFiltersBar,
  type FilterChip,
} from '@/components/list-filters-bar'
import { NO_PROJECT_KEY, type ReportsPeriod, periodLabel } from '@/lib/project-analytics'
import type { ServerProject } from '@/types/entities'

export interface ReportsFiltersState {
  projectKeys: string[]
  period: ReportsPeriod
}

export function buildDefaultReportsFilters(): ReportsFiltersState {
  return { projectKeys: [], period: '12m' }
}

export function hasActiveReportsFilters(filters: ReportsFiltersState): boolean {
  return filters.projectKeys.length > 0 || filters.period !== '12m'
}

function projectLabel(key: string, projects: ServerProject[]): string {
  if (key === NO_PROJECT_KEY) return 'Без проекта'
  return projects.find((p) => p.id === key)?.name ?? key
}

interface ReportsFiltersToolbarProps {
  filters: ReportsFiltersState
  onChange: (next: ReportsFiltersState) => void
  projects: ServerProject[]
  shownVps: number
  totalVps: number
}

export function ReportsFiltersToolbar({
  filters,
  onChange,
  projects,
  shownVps,
  totalVps,
}: ReportsFiltersToolbarProps) {
  const chips = useMemo((): FilterChip[] => {
    const out: FilterChip[] = []
    if (filters.projectKeys.length) {
      out.push({
        id: 'projects',
        label: `Проекты: ${filters.projectKeys.map((k) => projectLabel(k, projects)).join(', ')}`,
        onRemove: () => onChange({ ...filters, projectKeys: [] }),
      })
    }
    if (filters.period !== '12m') {
      out.push({
        id: 'period',
        label: `Период: ${periodLabel(filters.period)}`,
        onRemove: () => onChange({ ...filters, period: '12m' }),
      })
    }
    return out
  }, [filters, onChange, projects])

  const toggleProjectKey = (key: string) => {
    const set = new Set(filters.projectKeys)
    if (set.has(key)) set.delete(key)
    else set.add(key)
    onChange({ ...filters, projectKeys: [...set] })
  }

  const projectButtonLabel =
    filters.projectKeys.length === 0
      ? 'Все проекты'
      : `Проекты (${filters.projectKeys.length})`

  return (
    <ListFiltersBar
      controls={
        <>
          <Popover>
            <PopoverTrigger
              render={
                <Button variant="outline" className="w-full sm:w-auto">
                  <FolderKanbanIcon data-icon="inline-start" />
                  {projectButtonLabel}
                </Button>
              }
            />
            <PopoverContent className="w-72 p-3" align="start">
              <div className="flex flex-col gap-2">
                <p className="text-sm font-medium">Проекты</p>
                <div className="flex flex-col gap-2 max-h-56 overflow-y-auto">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="reports-project-none"
                      checked={filters.projectKeys.includes(NO_PROJECT_KEY)}
                      onCheckedChange={() => toggleProjectKey(NO_PROJECT_KEY)}
                    />
                    <Label htmlFor="reports-project-none" className="font-normal">
                      Без проекта
                    </Label>
                  </div>
                  {projects.map((p) => (
                    <div key={p.id} className="flex items-center gap-2">
                      <Checkbox
                        id={`reports-project-${p.id}`}
                        checked={filters.projectKeys.includes(p.id)}
                        onCheckedChange={() => toggleProjectKey(p.id)}
                      />
                      <Label htmlFor={`reports-project-${p.id}`} className="flex items-center gap-2 font-normal">
                        {p.color ? (
                          <span
                            className="size-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: p.color }}
                          />
                        ) : null}
                        {p.name}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            </PopoverContent>
          </Popover>
          <SelectField
            triggerClassName="w-full sm:w-44"
            placeholder="Период"
            value={filters.period}
            onValueChange={(v) =>
              onChange({ ...filters, period: (v as ReportsPeriod) ?? '12m' })
            }
            options={[
              { value: '3m', label: '3 месяца' },
              { value: '6m', label: '6 месяцев' },
              { value: '12m', label: '12 месяцев' },
              { value: 'all', label: 'Всё время' },
            ]}
          />
        </>
      }
      chips={chips}
      shown={shownVps}
      total={totalVps}
      resultsSuffix="VPS"
      showReset={hasActiveReportsFilters(filters)}
      onReset={() => onChange(buildDefaultReportsFilters())}
    />
  )
}
