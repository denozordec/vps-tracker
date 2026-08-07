---
name: MM ReUI System
overview: "Wave F — settings/alerts/data-collection/probes: Frame + SettingsShell; metric strips только **hybrid KpiStatGrid**."
todos:
  - id: f-settings
    content: settings → SettingsShell + Frame (hybrid KPI if metrics)
    status: pending
  - id: f-alerts
    content: "alerts: extract + Frame; hybrid KPI if metrics"
    status: pending
  - id: f-collect-probes
    content: "data-collection/probes: Frame + hybrid KPI strips"
    status: pending
isProject: false
---

# Wave F — System

Родитель: [MM ReUI Master](mm_reui_master_b80dbef6.plan.md). Зависимости: **A**; параллельно с **E**.

## Цель

System screens на Frame/SettingsShell; любые summary metrics → **hybrid KPI** как в старых apps.

## KPI (MUST)

- `/data-collection`, `/probes`, `/alerts` (если есть counters/summary) → только `KpiStatGrid` hybrid
- Preview: [stats-12](https://reui.io/preview/base/stats-12)
- Settings: обычно rows без KPI-полосы; если появятся — hybrid only
- NEVER: Card KPI, SectionCards

## Routes

| Route | ~LOC | Паттерн |
|-------|------|---------|
| `/settings` | ~1586 | SettingsShell + Frame rows; DataGrids в Frame |
| `/alerts` | ~2989 | Extract → Frame; summary → **hybrid** если есть |
| `/data-collection` | ~1250 | Frame grids; summary Cards → **hybrid** `KpiStatGrid` |
| `/probes` | ~1085 | Frame; schedule/speed grids; KPI → **hybrid** |

## Alerts strategy

F1 extract · F2 Frame + Badge/Alert · F3 DataGrid; KPI hybrid на F2 если есть метрики.

## ReUI refs

- Settings: [settings-16](https://reui.io/preview/base/settings-16) · [settings-3](https://reui.io/preview/base/settings-3)
- KPI: **только** [stats-12](https://reui.io/preview/base/stats-12)
- Alert: https://reui.io/docs/components/base/alert
- Lists: [data-grid-filtering-2](https://reui.io/preview/base/data-grid-filtering-2)

## Ключевые файлы

- [`app/(main)/settings/page.tsx`](c:/Users/shats/Dev/MikrotikManager-3/app/(main)/settings/page.tsx)
- [`app/(main)/alerts/page.tsx`](c:/Users/shats/Dev/MikrotikManager-3/app/(main)/alerts/page.tsx)
- [`app/(main)/data-collection/page.tsx`](c:/Users/shats/Dev/MikrotikManager-3/app/(main)/data-collection/page.tsx)
- [`app/(main)/probes/page.tsx`](c:/Users/shats/Dev/MikrotikManager-3/app/(main)/probes/page.tsx)

## DoD

- [ ] Settings на SettingsShell/Frame
- [ ] Alerts extract + Frame; API engine без изменений
- [ ] data-collection/probes: Frame + **hybrid** KPI где были Card metrics
- [ ] lint/build per sub-PR
