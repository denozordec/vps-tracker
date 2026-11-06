/** Shared grid column classes for hybrid KPI / Quick Actions tiles. */
export function kpiCols(count: number): string {
  if (count <= 1) return 'grid-cols-1'
  if (count === 2) return 'grid-cols-1 @xl:grid-cols-2'
  if (count === 3) return 'grid-cols-1 @3xl:grid-cols-3'
  if (count === 4) return 'grid-cols-1 @3xl:grid-cols-2 @5xl:grid-cols-4'
  // Design «VPS-Tracker»: at most 4 KPI columns, wrapping to the next row.
  return 'grid-cols-1 @xl:grid-cols-2 @5xl:grid-cols-4'
}
