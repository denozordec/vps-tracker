---
name: MM ReUI Dashboard
overview: Wave D — /dashboard и /traffic: **hybrid KpiStatGrid** (EvoBGP DNA) + OpsDashboard + QuickActionGrid + Frame charts.
todos:
  - id: dashboard-ops
    content: "Dashboard: StatCard → hybrid KpiStatGrid + OpsDashboard"
    status: pending
  - id: traffic-frame
    content: "Traffic: hybrid KpiStatGrid + Frame charts"
    status: pending
  - id: qa-grid
    content: QuickActionGrid (sibling hybrid DNA)
    status: pending
isProject: false
---

# Wave D — Dashboard & overview

Родитель: [MM ReUI Master](mm_reui_master_b80dbef6.plan.md). Зависимости: **A** (hybrid kit), **B** (эталон).

## Цель

Убрать hand-roll `StatCard` (Card). KPI = **hybrid как в старых apps**.

## KPI (MUST)

- `/dashboard` и `/traffic`: только `KpiStatGrid` hybrid ([stats-12](https://reui.io/preview/base/stats-12))
- Удалить локальный `StatCard` / Card metric grids
- NEVER: SectionCards, sparkline-inside-Card как KPI shell (sparkline может быть *внутри* hybrid tile через kit API, не отдельный Card KPI)
- Quick Actions: только `QuickActionGrid` (sibling hybrid), не Button/Card grid

## Routes

| Route | ~LOC | Работа |
|-------|------|--------|
| `/dashboard` | ~926 | `StatCard` → **hybrid** `KpiStatGrid`; `OpsDashboard`; Frame probes |
| `/traffic` | ~1020 | **hybrid** KPI; Frame charts; semantic tokens |

## ReUI refs (MCP `surface: frame`)

- [dashboard-1](https://reui.io/preview/base/dashboard-1)
- KPI: **только** [stats-12](https://reui.io/preview/base/stats-12) · QA [card-12](https://reui.io/preview/base/card-12) DNA via kit
- Charts: [chart-15](https://reui.io/preview/base/chart-15) adapt (не KPI substitute)
- Shell: [app-shell-12](https://reui.io/preview/base/app-shell-12)

## Ключевые файлы

- [`app/(main)/dashboard/page.tsx`](c:/Users/shats/Dev/MikrotikManager-3/app/(main)/dashboard/page.tsx)
- [`components/dashboard/latency-chart.tsx`](c:/Users/shats/Dev/MikrotikManager-3/components/dashboard/latency-chart.tsx), `bandwidth-chart.tsx`, `internet-path-map.tsx`
- [`components/data-grids/dashboard-active-probes-data-grid.tsx`](c:/Users/shats/Dev/MikrotikManager-3/components/data-grids/dashboard-active-probes-data-grid.tsx)
- [`app/(main)/traffic/page.tsx`](c:/Users/shats/Dev/MikrotikManager-3/app/(main)/traffic/page.tsx)

## Порядок секций

**Hybrid KPI** → QuickActionGrid → charts / path map → attention + probes.  
`showQuickActions` default true.

## Инварианты

- Не менять API fetch
- Path map — Frame wrap, не rewrite
- Не смешивать Card KPI с Frame

## DoD

- [ ] Нет `StatCard`/Card KPI на `/dashboard` и `/traffic`
- [ ] Только hybrid `KpiStatGrid` (EvoBGP DNA)
- [ ] Charts/path в Frame panels
- [ ] lint/build OK
