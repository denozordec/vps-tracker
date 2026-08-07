---
name: MM ReUI Network Ops
overview: "Wave E — network ops: Frame + **hybrid KpiStatGrid** на filters/firewall/bgp/ospf/recursive (+ хвост C)."
todos:
  - id: e1-bgp-rr
    content: "E1: recursive-routes + bgp Frame + hybrid KPI"
    status: pending
  - id: e2-filters
    content: "E2: filters extract + Frame + hybrid KPI if any"
    status: pending
  - id: e3-firewall
    content: "E3: firewall Frame + hybrid KPI if any"
    status: pending
  - id: e4-ospf
    content: "E4: ospf hybrid KPI + Frame (+ leftover C)"
    status: pending
isProject: false
---

# Wave E — Network ops

Родитель: [MM ReUI Master](mm_reui_master_b80dbef6.plan.md). Зависимости: **A+B**; пересечение с **C** без дубля.

## Цель

Giant network pages → Frame + kit; метрики только **hybrid KPI**.

## KPI (MUST)

- Любые analytics/summary Cards (`/bgp`, `/ospf`, `/firewall`, …) → **hybrid** `KpiStatGrid`
- Preview: [stats-12](https://reui.io/preview/base/stats-12)
- Если метрик на экране нет — KPI-блок не рисуем; если есть — только hybrid
- NEVER: Card KPI grid, SectionCards, stats-7 vertical

## Routes

| Route | ~LOC | Стратегия |
|-------|------|-----------|
| `/filters` | ~1790 | Frame layout; Sheets logic intact; KPI→hybrid если есть |
| `/firewall` | ~1725 | Frame panels; rules DataGrid; summary → hybrid |
| `/recursive-routes` | ~661 | Frame + DataGrid; KPI→hybrid если есть |
| `/bgp` | ~720 | analytics Cards → **hybrid** `KpiStatGrid`; sessions grid |
| `/ospf` | ~1270 | Frame tabs + grids; summary → **hybrid** |
| `/gre` `/backups` `/certificates` | — | Только если не закрыты C (там тоже hybrid) |

## Подход

1. Extract секций
2. Card shells → Frame
3. KPI → **hybrid** `KpiStatGrid`
4. `validate_usage`

## ReUI refs

- Lists: [data-grid-filtering-2](https://reui.io/preview/base/data-grid-filtering-2)
- KPI: **только** [stats-12](https://reui.io/preview/base/stats-12)
- Frame/DetailPanel docs

## PR split

E1 recursive+bgp · E2 filters · E3 firewall · E4 ospf (+ leftover)

## DoD

- [ ] Нет Card page shell
- [ ] Все metric strips — hybrid `KpiStatGrid`
- [ ] API/CRUD без регрессий
- [ ] lint/build per PR
