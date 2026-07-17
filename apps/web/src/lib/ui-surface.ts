/**
 * VPS Tracker UI surface contract (ReUI Pro).
 *
 * Ops / list / dashboard / detail / settings: **Frame** only.
 * KPI: **stats-12** via `reui-kit/KpiStatGrid`.
 * Lists: **data-grid-filtering-2** via `reui-kit/ResourcePage`.
 *
 * @see https://reui.io/preview/base/stats-12
 * @see https://reui.io/preview/base/data-grid-filtering-2
 * @see docs/ui-design-contract.md
 */
export const UI_SURFACE = 'frame' as const

/** Grid for ReUI stats-12 KPI rows (3–6 tiles). */
export const kpiStatGridClassName = '@container w-full'
