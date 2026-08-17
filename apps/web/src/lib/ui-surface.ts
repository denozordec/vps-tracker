/**
 * VPS Tracker UI surface contract (ReUI Pro).
 *
 * Ops / list / dashboard / detail / settings: **Frame** only.
 * KPI: horizontal compact hybrid via `reui-kit/KpiStatGrid`
 * (`IconTile` elevated `size-10.5` + label/Badge + value ± variant).
 * Lists: **data-grid-filtering-2** via `reui-kit/ResourcePage`.
 *
 * @see https://reui.io/preview/base/stats-12
 * @see https://reui.io/preview/base/data-grid-filtering-2
 * @see docs/ui-design-contract.md
 */
export const UI_SURFACE = 'frame' as const

/** Skip link — keyboard: first Tab. */
export const SKIP_TO_CONTENT_CLASS =
  'bg-background text-foreground ring-ring sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:shadow-sm focus:ring-2'

/** Grid for horizontal compact hybrid KPI rows (3–6 tiles). */
export const kpiStatGridClassName = '@container w-full'
