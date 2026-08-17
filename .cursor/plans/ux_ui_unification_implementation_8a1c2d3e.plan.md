---
name: UX UI Unification Implementation
overview: "Реализация UX-UI-PLAN.md: идентичный chrome 1:1 во всех 6 приложениях, затем IconTile/rules, kit DNA, Card→Frame. Phase 0 (аудит) уже в UX-UI-PLAN.md. Production-код начинается с Phase 1."
todos:
  - id: phase-1-auth
    content: "CHANGE-001: Auth Portal SystemMonitorPopover + header AppsMenu→monitor (app-shell-7)"
    status: completed
  - id: phase-1-mm
    content: "CHANGE-002/032/033/034: MM chrome — 240px, App Switcher, NavUser segmented, AppsMenu+SystemMonitor, без Rail/Search pill"
    status: completed
  - id: phase-1-vite
    content: "CHANGE-003: сверка VPS/CFDM/EvoBGP/FW + Auth SIDEBAR_WIDTH 240px"
    status: completed
  - id: phase-2-icontile
    content: "Phase 2: CLI @reui/icon-tile во всех 6 + RULE-CHANGE Frame SoT MM (CHANGE-004, 024–028)"
    status: completed
  - id: phase-3-kit
    content: "Phase 3: KpiStatGrid/QuickActionGrid на IconTile; Auth /apps kit (CHANGE-005–008, 021–022)"
    status: completed
  - id: phase-4-frame
    content: "Phase 4: Card→Frame на ops-страницах VPS/EvoBGP/MM (CHANGE-009–018)"
    status: completed
  - id: phase-5-6
    content: "Phase 6: a11y/responsive verification (Phase 5 CHANGE-016/019/020/030/031 done)"
    status: completed
isProject: false
---

# UX/UI Unification — Implementation

Источник: [`UX-UI-PLAN.md`](c:/Users/shats/Dev/vps-tracker/UX-UI-PLAN.md). Аудит-план [`ux_ui_unification_audit_276a34f8.plan.md`](c:/Users/shats/Dev/vps-tracker/.cursor/plans/ux_ui_unification_audit_276a34f8.plan.md) **не менять**.

Уровень: **идентичный chrome во всех 6** + общая UX-система; доменные страницы остаются разными.

Эталоны chrome: [app-shell-12](https://reui.io/preview/base/app-shell-12) · [app-shell-7](https://reui.io/preview/base/app-shell-7) · [app-shell-1](https://reui.io/preview/base/app-shell-1). Docs: [reui.io/blocks](https://reui.io/blocks) · [reui.io/docs](https://reui.io/docs).

## Chrome Identity Spec (1:1 — все 6)

- Sidebar `--sidebar-width: 240px`
- Sidebar header: App Switcher (`cfdm` · `vps` · `bgp` · `fw` · `dns`; MM локальный `mm` + те же ids)
- Footer: NavUser + segmented theme (light/dark/system), без Sun/Moon
- Header right: AppsMenu → SystemMonitorPopover; без ModeToggle; поиск только ⌘K
- Main: `gap-4 md:gap-6`, `px-4 py-4 md:px-6 md:py-5`
- Запрещено: SidebarRail, Search pill в header/sidebar
- Auth **login** без AppShell ([auth-18](https://reui.io/preview/base/auth-18))

**Не менять:** Vite vs Next, package scopes, API/SSO/OIDC, CRUD. Не мержить kit в один npm. Не мигрировать TanStack Table v8→v9 в этом плане.

## Phase 1 — Chrome (сейчас)

| ID | Project | Что сделать |
|---|---|---|
| CHANGE-001 | Auth Portal | `SystemMonitorPopover` после AppsMenu; header `z-10` `gap-2` |
| CHANGE-002 | MM | Switcher, header cluster, убрать Search pill + Sun/Moon |
| CHANGE-032 | MM | NavUser в footer, segmented theme |
| CHANGE-033 | MM | удалить SidebarRail |
| CHANGE-034 | MM | `SIDEBAR_WIDTH = 240px` |
| CHANGE-003 | VPS/CFDM/BGP/FW + Auth primitive | сверка; Auth `packages/ui` sidebar 16rem → 240px |

MM остаётся Next.js 16. Без `@tanstack/react-query` для chrome (fetch + `useEffect`).

## Later phases (не в этом проходе)

- **Phase 2:** IconTile CLI, rules Frame SoT MM
- **Phase 3:** kit DNA KPI/QA
- **Phase 4:** Card→Frame pages
- **Phase 5–6:** empty/sheets, a11y
