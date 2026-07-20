/** Shared grid column classes for hybrid KPI / Quick Actions tiles. */
export function kpiCols(count: number): string {
  if (count <= 1) return 'grid-cols-1'
  if (count === 2) return 'grid-cols-1 @xl:grid-cols-2'
  if (count === 3) return 'grid-cols-1 @3xl:grid-cols-3'
  if (count === 4) return 'grid-cols-1 @3xl:grid-cols-2 @6xl:grid-cols-4'
  if (count === 5) return 'grid-cols-2 @3xl:grid-cols-3 xl:grid-cols-5'
  if (count === 6) return 'grid-cols-2 sm:grid-cols-3 xl:grid-cols-6'
  return 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4'
}
