import type { VisibilityState } from "@tanstack/react-table"
import type { DataGridColumn } from "@/components/data-grid-types"

export function loadStoredColumnVisibility(key: string): VisibilityState | undefined {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return undefined
    return JSON.parse(raw) as VisibilityState
  } catch {
    return undefined
  }
}

export interface DataGridColumnVisibilityOption {
  id: string
  label: string
}

export function dataGridColumnVisibilityOptions<T>(
  cols: DataGridColumn<T>[],
): DataGridColumnVisibilityOption[] {
  return cols
    .filter((c) => c.enableHiding !== false)
    .map((c) => ({
      id: c.key,
      label: c.headerTitle ?? (typeof c.header === "string" ? c.header : c.key),
    }))
}
