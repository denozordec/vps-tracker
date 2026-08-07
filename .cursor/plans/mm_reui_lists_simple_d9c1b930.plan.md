---
name: MM ReUI Lists Simple
overview: Wave B — /servers и simple lists на Frame + **hybrid KpiStatGrid** (EvoBGP DNA) + ResourcePage.
todos:
  - id: servers-etalon
    content: "/servers: Frame + hybrid KpiStatGrid (не Card KPI)"
    status: pending
  - id: simple-lists
    content: domains / asns / ip-ranges / releases
    status: pending
  - id: loading-skeleton
    content: loading.tsx skeleton под hybrid KPI + Frame
    status: pending
  - id: rules-etalon
    content: Закрепить Frame+/servers hybrid KPI как эталон
    status: pending
isProject: false
---

# Wave B — Etalon + simple lists

Родитель: [MM ReUI Master](mm_reui_master_b80dbef6.plan.md). Зависимость: **Wave A** (hybrid `KpiStatGrid` в kit).

## Цель

Сделать `/servers` эталоном ReUI PRO: Frame shell + **hybrid KPI** как в EvoBGP/vps/CFDM.

## KPI (MUST)

- Метрики на `/servers` (всего / онлайн / JH+Exit / Home) → **только** `KpiStatGrid` hybrid
- Preview: [stats-12](https://reui.io/preview/base/stats-12)
- Удалить `grid … Card` KPI strip; **запрещены** StatCard / SectionCards / vertical stats
- Name-cells в grid: hybrid icon tile (`bg-muted` + semantic text)

## Routes

| Route | ~LOC | Работа |
|-------|------|--------|
| `/servers` | ~724 | **Эталон:** **hybrid** `KpiStatGrid`; Frame; toolbar+Filters+`ServersDataGrid`; Sheet+Stepper без редизайна |
| `/domains` | ~98 | Frame + DataGrid (+ empty); KPI — только если появятся метрики → hybrid |
| `/asns` | ~98 | То же |
| `/ip-ranges` | ~99 | То же |
| `/releases` | ~97 | Frame/settings-lite; без KPI, если нет метрик |

## ReUI refs

- List: [data-grid-filtering-2](https://reui.io/preview/base/data-grid-filtering-2) · [data-grid-filtering-1](https://reui.io/preview/base/data-grid-filtering-1)
- KPI: **только** [stats-12](https://reui.io/preview/base/stats-12) hybrid via kit
- Empty: [empty-state-12](https://reui.io/preview/base/empty-state-12)
- Forms sheet: [form-7](https://reui.io/preview/base/form-7)

MCP: `search`/`get_block`/`validate_usage` с `surface: "frame"`.

## Ключевые файлы

- [`app/(main)/servers/page.tsx`](c:/Users/shats/Dev/MikrotikManager-3/app/(main)/servers/page.tsx)
- [`components/data-grids/servers-data-grid.tsx`](c:/Users/shats/Dev/MikrotikManager-3/components/data-grids/servers-data-grid.tsx)
- [`app/(main)/loading.tsx`](c:/Users/shats/Dev/MikrotikManager-3/app/(main)/loading.tsx) — skeleton под Frame + hybrid KPI
- [`lib/data-filters/server-filter-fields.ts`](c:/Users/shats/Dev/MikrotikManager-3/lib/data-filters/server-filter-fields.ts)

## Правила

- Не менять API CRUD / poll / test connection
- После миграции: `ma-ui-guardian` / `next-shadcn-production` — эталон = Frame + hybrid KPI `/servers`

## DoD

- [ ] `/servers`: нет Card KPI; только hybrid `KpiStatGrid`
- [ ] domains/asns/ip-ranges на Frame+DataGrid
- [ ] loading skeleton согласован с hybrid strip
- [ ] UI Guardian сверка с новым эталоном
- [ ] lint/build OK
