export {
  type CustomFieldDef,
  type CustomFieldType,
  parseCustomFieldDefs,
  parseCustomData,
  slugifyCustomFieldKey,
  formatCustomFieldValue,
} from '@cfdm/shared/contracts/custom-fields'

import type { ReactNode } from 'react'
import { Badge } from '@cfdm/ui/components/badge'
import {
  type CustomFieldDef,
  formatCustomFieldValue,
  parseCustomData,
} from '@cfdm/shared/contracts/custom-fields'
import type { DataTableColumn } from '@/components/data-grid-types'

export function buildCustomFieldColumns<T extends { customData?: unknown }>(
  defs: CustomFieldDef[],
): DataTableColumn<T>[] {
  return defs.map((def) => ({
    key: `custom_${def.key}`,
    header: def.label,
    headerTitle: def.label,
    enableHiding: true,
    sortValue: (row) => {
      const data = parseCustomData(row.customData)
      const val = data[def.key]
      if (def.type === 'bool') return val ? 1 : 0
      if (def.type === 'number') return Number(val) || 0
      return String(val ?? '')
    },
    cell: (row): ReactNode => {
      const data = parseCustomData(row.customData)
      const val = data[def.key]
      if (val === undefined || val === null || val === '') {
        return <span className="text-muted-foreground">—</span>
      }
      if (def.type === 'bool') {
        return (
          <Badge variant={val ? 'default' : 'outline'}>
            {formatCustomFieldValue(def, val)}
          </Badge>
        )
      }
      if (def.type === 'number') {
        return (
          <span className="tabular-nums text-muted-foreground">
            {formatCustomFieldValue(def, val)}
          </span>
        )
      }
      const text = formatCustomFieldValue(def, val)
      return (
        <span className="block max-w-[200px] truncate text-muted-foreground" title={text}>
          {text}
        </span>
      )
    },
  }))
}

export function buildCustomFieldColumnVisibility(
  defs: CustomFieldDef[],
): Record<string, boolean> {
  const visibility: Record<string, boolean> = {}
  for (const def of defs) {
    visibility[`custom_${def.key}`] = false
  }
  return visibility
}
