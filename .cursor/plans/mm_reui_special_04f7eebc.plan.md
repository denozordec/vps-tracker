---
name: MM ReUI Special
overview: "Wave G — special surfaces: Frame chrome; KPI на uptime/optimizer только **hybrid KpiStatGrid** (EvoBGP DNA)."
todos:
  - id: g1-term-opt
    content: "G1: terminal Frame; optimizer Frame + hybrid KPI"
    status: pending
  - id: g2-uptime
    content: "G2: uptime extract + Frame + hybrid KpiStatGrid"
    status: pending
  - id: g3-map
    content: "G3: network-map Frame chrome (KPI hybrid if any)"
    status: pending
isProject: false
---

# Wave G — Special surfaces

Родитель: [MM ReUI Master](mm_reui_master_b80dbef6.plan.md). Зависимости: **A+B**.

## Цель

Кастом map/CLI без форса DataGrid. Metric strips — **только hybrid KPI** как в старых apps.

## KPI (MUST)

- `/uptime`, `/route-optimizer` (и map, если есть summary): Card/Stat KPI → **hybrid** `KpiStatGrid`
- Preview: [stats-12](https://reui.io/preview/base/stats-12)
- `/terminal`: обычно без KPI-полосы
- NEVER: StatCard, SectionCards, vertical-only

## Routes

| Route | ~LOC | Стратегия |
|-------|------|-----------|
| `/network-map` | ~2254 | Frame side panels; canvas без redesign; KPI→hybrid если есть |
| `/terminal` | ~552 | Frame CLI; без KPI |
| `/uptime` | ~2669 | Extract; **hybrid** `KpiStatGrid`; grids → Frame |
| `/route-optimizer` | ~1034 | Frame tabs; Card KPI → **hybrid** |

## ReUI refs

- KPI: **только** [stats-12](https://reui.io/preview/base/stats-12)
- [dashboard-1](https://reui.io/preview/base/dashboard-1) для uptime overview layout
- Lists: [data-grid-filtering-2](https://reui.io/preview/base/data-grid-filtering-2)

## PR split

G1 terminal+optimizer · G2 uptime · G3 network-map

## Инварианты

- Не менять map/terminal protocols
- Card только как interactive widget, не page shell / не KPI

## DoD

- [ ] Нет Card page shell
- [ ] uptime/optimizer KPI = hybrid `KpiStatGrid`
- [ ] Map/terminal smoke OK
- [ ] Final lint/build + contract checklist
