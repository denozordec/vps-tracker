---
name: MM ReUI Lists Medium
overview: "Wave C — medium CRUD: Frame + **hybrid KpiStatGrid** (EvoBGP DNA) на communities/wg/vxlan/containers/gre/backups/certificates."
todos:
  - id: c1-small-crud
    content: "communities/wg/vxlan/containers: hybrid KPI + Frame"
    status: pending
  - id: c2-tunnels-certs
    content: "gre/backups/certificates: hybrid KPI + Frame"
    status: pending
isProject: false
---

# Wave C — Medium CRUD lists

Родитель: [MM ReUI Master](mm_reui_master_b80dbef6.plan.md). Зависимость: **Wave B** (эталон hybrid KPI).

## Цель

Тиражировать `/servers`: Frame shell + **hybrid KPI** на medium CRUD.

## KPI (MUST)

- Любой metric strip на этих routes → только `KpiStatGrid` hybrid ([stats-12](https://reui.io/preview/base/stats-12))
- Замена существующих `Card` KPI grids — без исключений
- NEVER: StatCard, SectionCards, vertical-only, raw emerald

## Routes (priority)

| Route | ~LOC | Паттерн |
|-------|------|---------|
| `/communities` | ~268 | Card KPI → **hybrid** `KpiStatGrid`; Frame + CommunitiesDataGrid |
| `/wireguard` | ~256 | То же + peers detail |
| `/vxlan` | ~250 | То же |
| `/containers` | ~435 | Card list → DataGrid/Frame tiles; KPI → **hybrid** |
| `/gre` | ~778 | Dual grids + **hybrid** KPI strip |
| `/backups` | ~752 | **hybrid** KPI + DataGrid + Stepper |
| `/certificates` | ~779 | **hybrid** KPI + DataGrid + Stepper |

Split PR: C1 / C2 при необходимости.

## Refs

- KPI: **только** [stats-12](https://reui.io/preview/base/stats-12) via kit
- Lists: [data-grid-filtering-2](https://reui.io/preview/base/data-grid-filtering-2)
- Stepper — reuse

## DoD

- [ ] Нет Card как ops shell
- [ ] Все KPI-полосы — hybrid `KpiStatGrid` (как EvoBGP)
- [ ] Визуально = `/servers`
- [ ] lint/build OK
