---
name: MM ReUI Foundation
overview: "Wave A — foundation: ui-design-contract, kpi-hybrid rule, порт KpiStatGrid (EvoBGP hybrid DNA 1:1), Card→Frame shell, chrome (240px, NavUser)."
todos:
  - id: docs-contract
    content: ui-design-contract + reui-mcp/kpi-hybrid rules + AGENTS
    status: pending
  - id: port-kit
    content: "Порт reui-kit: KpiStatGrid hybrid DNA 1:1 с EvoBGP"
    status: pending
  - id: frame-bridge
    content: DataPageCard → Frame surface bridge
    status: pending
  - id: chrome-240-navuser
    content: Sidebar 240px + NavUser segmented theme
    status: pending
isProject: false
---

# Wave A — Foundation (MikrotikManager ReUI)

Родитель: [MM ReUI Master](mm_reui_master_b80dbef6.plan.md). Источники: [Explore MikrotikManager UI](a9e538ec-d664-4bf5-a712-4978beefe057), [ReUI SoT from siblings](97b837f2-382e-4bf9-b0fc-84678deb882c).

## Цель

Подготовить инфраструктуру ReUI PRO **без** массовой миграции страниц. После Wave A любой экран переводится на Frame + **hybrid KPI** (`KpiStatGrid`) по шаблону старых apps.

## KPI hybrid (закладывается здесь)

- Порт `KpiStatGrid` **байт-в-байт DNA** с EvoBGP (horizontal compact: icon `size-10.5` `bg-muted` + label/Badge + value ± variant)
- Preview: [stats-12](https://reui.io/preview/base/stats-12) · rule `kpi-hybrid.mdc` в MM
- **NEVER** в kit: SectionCards, vertical-only stats, Card KPI wrappers
- Волны B–G только **потребляют** этот kit — не рисуют свои KPI

## Scope

### 1. Документы и rules

- Создать [`docs/ui-design-contract.md`](c:/Users/shats/Dev/MikrotikManager-3/docs/ui-design-contract.md) — адапт семейного контракта под пути MM (`components/reui`, `components/reui-kit`, `@/components/ui`, Next App Router); секция KPI = hybrid only
- Cursor rules: `reui-mcp.mdc`, **`kpi-hybrid.mdc`** (копия семейного MUST/NEVER); обновить [`next-shadcn-production.mdc`](c:/Users/shats/Dev/MikrotikManager-3/.cursor/rules/next-shadcn-production.mdc)
- Секция ReUI + KPI hybrid в [`AGENTS.md`](c:/Users/shats/Dev/MikrotikManager-3/AGENTS.md)

### 2. Kit port (SoT = EvoBGP)

Создать `components/reui-kit/`:

| Component | Источник |
|-----------|----------|
| **`KpiStatGrid`** | EvoBGP `kpi-stat-grid.tsx` — **hybrid DNA 1:1**, импорты → `@/components/ui/*` |
| `QuickActionGrid` | EvoBGP sibling hybrid DNA (не Card grid) |
| `ResourcePage` | Frame + tabs + Filters + DataGrid |
| `OpsDashboard` | **hybrid** KPI strip + afterKpi + charts slot |
| `DetailPanel` | Frame sections (+ Metrics → KpiStatGrid) |
| `SettingsShell` | Next nested layout / local nav (не TanStack Outlet) |
| `filter-utils` | apply/clear Filters |

`"use client"` на всех kit-компонентах с хуками (`rsc: true` в MM).

### 3. Surface bridge

- [`DataPageCard`](c:/Users/shats/Dev/MikrotikManager-3/components/data-page-card.tsx): заменить внутренний `Card` на ReUI `Frame`/`FramePanel` **или** ввести `DataPageFrame` + deprecate Card-shell (совместимый API `children`/`className`, чтобы Wave B+ меняли минимум)
- Сохранить [`DataGridShell`](c:/Users/shats/Dev/MikrotikManager-3/components/data-grids/shared/data-grid-shell.tsx) как есть

### 4. Chrome

- [`components/ui/sidebar.tsx`](c:/Users/shats/Dev/MikrotikManager-3/components/ui/sidebar.tsx): `SIDEBAR_WIDTH` `16rem` → **`240px`**
- [`app-sidebar.tsx`](c:/Users/shats/Dev/MikrotikManager-3/components/app-sidebar.tsx): подключить [`NavUser`](c:/Users/shats/Dev/MikrotikManager-3/components/nav-user.tsx) с segmented theme (убрать demo Sparkles/Billing); убрать дублирующий theme toggle из footer если переезжает в NavUser
- Search: оставить ⌘K (не Search pill в header)
- **AppsMenu / auth-portal / SystemMonitor — вне scope** (см. master)

### 5. MCP / CLI hygiene

- `user-reui` `get_project_context` + `surface: frame` на будущих задачах
- При add PRO blocks: `npx shadcn@latest add @reui/<name> --dry-run` перед overwrite существующих `components/reui/*`
- Preview refs: [app-shell-12](https://reui.io/preview/base/app-shell-12), **[stats-12](https://reui.io/preview/base/stats-12)** (hybrid KPI)

## Out of scope

Миграция `app/(main)/*/page.tsx` (кроме smoke-проверки, что Frame-bridge не ломает layout).

## DoD

- [ ] `docs/ui-design-contract.md` + `kpi-hybrid.mdc` на месте
- [ ] `KpiStatGrid` markup совпадает с EvoBGP (diff только imports)
- [ ] `components/reui-kit/*` собирается, импорты `@/components/ui`
- [ ] List shell = Frame (не Card)
- [ ] Sidebar 240px + NavUser theme
- [ ] `npm run lint` / `npm run build` без регрессий от foundation
