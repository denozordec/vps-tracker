# UX/UI Unification Plan

Дата аудита: 2026-08-17  
Implementation: **DONE 2026-08-17** — CHANGE-001…034, Phases 1–6, Acceptance §19.  
Уровень унификации (решение пользователя): **система + идентичный chrome во всех 6 приложениях**; доменные экраны **не** копируются.

Источники истины REUI PRO: [reui.io/docs](https://reui.io/docs) · [reui.io/llms.txt](https://reui.io/llms.txt) · MCP `user-reui` (`get_block` / `get_component` / `get_example` / `compose_page`). Skill ReUI: `668fb463eb` (локально и MCP совпадают). Версию REUI PRO **не** указываем — её нет.

---

## 1. Executive Summary

Workspace — 6 fullstack UI-приложений. Пять Vite SPA уже lock `surface: frame` + `reui-kit`. MikrotikManager — Next.js 16 App Router со SoT `/servers` на shadcn `Card` (`DataPageCard`). Это **две дизайн-системы** в одном workspace.

Целевое состояние:

- **Одинаковый chrome 1:1** во всех шести (включая Auth Portal и MikrotikManager): sidebar 240px, App Switcher, header AppsMenu → SystemMonitor, footer NavUser + segmented theme.
- **Одинаковый рецепт** ops-экранов: Frame, DataGrid+Filters, KPI = stats-12 + IconTile `elevated`, Quick Actions = Frame tiles, settings-3/16, Sheet для create/edit, Frame-friendly empty.
- **Разный домен:** topology VPS, DNS/kanban CFDM, BIRD/lookup EvoBGP, IdP Auth Portal, agents EvoFirewall, `/servers`/terminal MikrotikManager.
- **Не менять:** Vite vs Next, package scopes, API/SSO/OIDC, CRUD-поведение.

Главные gaps: Auth Portal без SystemMonitor; MikrotikManager без AppsMenu/NavUser/Switcher и с Sun/Moon toggle; ни один проект не установил `icon-tile`; VPS Card-shells на detail/charts; MM `DataPageCard` = Card.

---

## 2. Workspace Coverage

`Discovered projects: 6`  
`Audited projects: 6`  
`Projects with plan: 6`  
`Coverage: 100%`  
`Implementation: 34/34 CHANGE DONE (2026-08-17)`

| # | Project | Path | Type | Audited | Changes | Status |
|---|---|---|---|---|---|---|
| 1 | VPS Tracker | `c:\Users\shats\Dev\vps-tracker` | fullstack Vite SPA | YES | CHANGE-003, 004, 005, 009–014, 025, 029 | Implemented |
| 2 | Cloudflare Domain Manager | `c:\Users\shats\Dev\cloudflare-domain-manager` | fullstack Vite SPA | YES | CHANGE-003, 004, 005, 006, 024 | Implemented |
| 3 | EvoBGP | `c:\Users\shats\Dev\EvoBGP` | fullstack Go API + Vite SPA | YES | CHANGE-003, 004, 005, 015–017, 019 | Implemented |
| 4 | Auth Portal | `c:\Users\shats\Dev\auth-portal` | fullstack Vite SPA | YES | CHANGE-001, 004, 005, 021–023 | Implemented |
| 5 | EvoFirewall | `c:\Users\shats\Dev\EvoFirewall` | fullstack Vite SPA | YES | CHANGE-003, 004, 005, 007, 020 | Implemented |
| 6 | MikrotikManager | `c:\Users\shats\Dev\MikrotikManager-3` | fullstack Next.js 16 | YES | CHANGE-002, 004, 008, 018, 027, 032–034 | Implemented |

Backend-only проектов нет. Shared UX/UI rules: CHANGE-026, 028, 030, 031, RULE-CHANGE-001…010.

---

## 3. Workspace Inventory

| Project | Framework | Language | UI | CSS | Theme | Package UI | Kit |
|---|---|---|---|---|---|---|---|
| VPS Tracker | Vite + TanStack Router/Query | TS | shadcn base-nova + ReUI | Tailwind v4 | next-themes | `@cfdm/ui` | `reui-kit` (9 files) |
| CFDM | Vite + TanStack | TS | shadcn base-nova + ReUI | Tailwind v4 | next-themes | `@cfdm/ui` | `reui-kit` (8 files) |
| EvoBGP | Vite + TanStack; API Go | TS / Go | shadcn base-nova + ReUI | Tailwind v4 | next-themes | `@evobgp/ui` | `reui-kit` (7 files) — **KPI SoT** |
| Auth Portal | Vite + TanStack | TS | shadcn base-nova + ReUI | Tailwind v4 | next-themes | `@authportal/ui` | `reui-kit` (11 files; `ResourcePage` stub) |
| EvoFirewall | Vite + TanStack | TS | shadcn base-nova + ReUI | Tailwind v4 | next-themes | `@evofw/ui` | `reui-kit` (6 files) |
| MikrotikManager | Next.js 16 App Router | TS | shadcn + **partial** ReUI | Tailwind v4 | custom `theme-provider` (`rl-theme`) | `@/components/ui` | **нет** `reui-kit` |

TanStack Table во всех web-приложениях: `^8.21.x`. ReUI Data Grid docs (MCP `get_component`): TanStack Table **v9**. Это technical risk — см. §18. Не мигрировать v8→v9 в этом плане.

`icon-tile`: **не установлен ни в одном** из 6 (поиск `IconTile` / `icon-tile` = 0 файлов).

---

## 4. MCP / Skills / Plugins Inventory

| Tool | Status | Use in audit |
|---|---|---|
| MCP `user-reui` | ready | `get_block`, `get_component`, `get_example`, `get_agent_skill` — официальные `docsUrl`/`previewUrl` |
| MCP `plugin-shadcn-shadcn` | listed | primitives `@shadcn` (secondary) |
| MCP codegraph (vps / CFDM / EvoBGP) | available | не заменял filesystem inventory |
| Skill `.claude/skills/reui` | `668fb463eb` | совпадает с MCP `get_agent_skill` |
| Skill shadcn (plugin + CFDM/EvoFirewall) | present | CLI/registry, не SoT для PRO blocks |
| Context7 MCP | available | не нужен для REUI PRO URLs |

Приоритет: официальная документация REUI PRO > MCP metadata > project rules.

---

## 5. Project Rules Inventory

| Source | Project | Category | Used? |
|---|---|---|---|
| `docs/ui-design-contract.md` | VPS, CFDM, EvoBGP, Auth, FW | UX/UI contract (Frame, chrome, kit) | YES — baseline |
| `.cursor/rules/reui-mcp.mdc` | 5 Vite | ReUI MCP workflow | YES |
| `.cursor/rules/kpi-hybrid.mdc` | 5 Vite | KPI Item `size-10.5` DNA | YES — **устарело vs IconTile** |
| `.cursor/rules/frontend-shadcn.mdc` / `frontend-ui-patterns.mdc` | VPS, CFDM, Auth, FW | patterns | YES; VPS lists `kanban-board.tsx`, которого нет на диске |
| `.cursor/rules/web-shadcn.mdc` | EvoBGP | WEB-01…WEB-22 | YES |
| `AGENTS.md` | VPS, EvoBGP, Auth, FW, MM | agent guide | YES; **CFDM: `<not_found>`** |
| `.cursor/rules/next-shadcn-production.mdc` | MM | SoT = `/servers` Card | YES — **противоречит унификации** |
| `.cursor/rules/ma-ui-guardian.mdc` | MM | UI Guardian = `/servers` | YES — **противоречит** |
| Workspace `reui-pro-senior-frontend.mdc` | all | chrome + Frame lock | YES; Auth ids без `dns` |

Technical rules (Fastify/Drizzle/Go/Next App Router/CI) — **не менять** ради UI.

---

## 6. Project UX/UI Rules Audit

| Rule | Source | Current Usage | Problem | Recommendation | Status |
|---|---|---|---|---|---|
| Surface `frame` | ui-design-contract | 5 Vite mostly; MM Card | MM + VPS mixed Card | TARGET-001 | MODIFY (enforce all 6) |
| Chrome 240px / AppsMenu / NavUser | contract | 4 Vite close; Auth no monitor; MM none | Identity drift | TARGET-006 | NEW (1:1 all 6) |
| KPI hybrid Item tile | kpi-hybrid.mdc | 5 Vite kit | Official primitive IconTile unused | TARGET-003 | REPLACE |
| Lists DataGrid+Filters | contract | Vite ResourcePage; MM DataPageCard | MM Card; VPS `spaces` Table | TARGET-002 | MODIFY |
| Settings settings-16 / settings-3 | contract | CFDM closest | settings-7 is `surface: card` | TARGET-005 | MODIFY |
| Empty empty-state-12 | contract | mixed | empty-state-11 is Card; prefer 14 | TARGET-008 | MODIFY |
| MM SoT `/servers` Card | next-shadcn-production | enforced | Blocks Frame unification | RULE-CHANGE-001 | REPLACE |
| App Switcher ids | Auth contract vs `APP_IDS` | code has `dns` | Contract omits `dns` | CHANGE-023 | MODIFY |
| Installed ReUI lists | reui-mcp.mdc | claims kanban in VPS | File missing | CHANGE-025 | MODIFY |
| CFDM AGENTS.md / ui-surface.ts | contract mentions | `<not_found>` | Rules drift | CHANGE-024 | NEW |

---

## Chrome Identity Spec (обязательный 1:1 — все 6)

Эталон: [app-shell-12](https://reui.io/preview/base/app-shell-12) + [app-shell-7](https://reui.io/preview/base/app-shell-7) (SystemMonitor) + [app-shell-1](https://reui.io/preview/base/app-shell-1) (NavUser).

Применяется к **каждому** приложению, включая Auth Portal `_auth` shell и MikrotikManager `(main)` layout. Login Auth Portal **без** AppShell — отдельный auth surface ([auth-18](https://reui.io/preview/base/auth-18)).

| Зона | Обязательное значение | Сейчас VPS/CFDM/BGP/FW | Auth Portal | MikrotikManager |
|---|---|---|---|---|
| `--sidebar-width` | `240px` | `240px` (`packages/ui/.../sidebar.tsx`) | 240px (ожидаемо, тот же паттерн) | **`16rem`** (`components/ui/sidebar.tsx`) |
| Sidebar header | App Switcher ids `cfdm` · `vps` · `bgp` · `fw` · `dns` | есть | есть | **нет** |
| Sidebar footer | NavUser + segmented theme (light/dark/system), без Sun/Moon icon | NavUser segmented | NavUser segmented | **hand-roll** avatar + Sun/Moon (`app-sidebar.tsx` ~239–266); `nav-user.tsx` **не используется** |
| Header right | AppsMenu → SystemMonitorPopover; без ModeToggle; без Search-кнопки (только ⌘K) | AppsMenu + SystemMonitor | AppsMenu **без** SystemMonitor (`site-header.tsx` 73–75) | нет AppsMenu / SystemMonitor; `CommandPaletteButton` в sidebar header |
| Header | `h-12`, sticky, `border-b`, `px-4 md:px-6` | да | да | `<uncertain>` vs Vite (Next layout свой) |
| Main | `gap-4 md:gap-6`, `px-4 py-4 md:px-6 md:py-5` | contract | contract | `<not_verified>` pixel-match |
| Theme | next-themes **или эквивалент с тем же UX** + semantic `--success/--warning/--info/--invert` | next-themes | next-themes | custom `theme-provider` `rl-theme` — UX должен стать segmented 3-way |
| Запрещено | `SidebarRail`, Search pill в header, ModeToggle в header | Vite: без Rail | без Rail | **`SidebarRail` есть** (`app-sidebar.tsx` 267) |

SSO: вход через auth-portal; App Switcher `GET /api/v1/app-switcher`. Ids в коде: `packages/shared/src/contracts/auth.ts` `APP_IDS = ['cfdm', 'vps', 'bgp', 'fw', 'dns']`.

---

## 7. UX/UI Audit — VPS Tracker

**Identity:** Vite SPA `apps/web`, `@cfdm/ui`, ReUI CLI в `apps/web/src/components/reui/`.  
**Routes (`_auth/`):** dashboard, vps, `vps.$vpsId`, accounts, providers, projects, `projects.$projectId`, payments, balance, tariffs, renewals, resources, reports, spaces, topology, audit, sync-journal.  
**Kit:** `resource-page`, `kpi-stat-grid`, `quick-action-grid`, `ops-dashboard`, `settings-shell`, `detail-panel`, `frame-data-grid`, `settings-card`, `topology-canvas`. Нет `kanban-board`.  
**ReUI on disk:** autocomplete, badge, icon-stack, filters, frame, alert, color-picker, timeline, number-field, date-selector + `data-grid/*`. Нет `icon-tile`, нет `kanban`.  
**Chrome:** `app-shell.tsx` — SystemMonitor есть; sidebar 240px.  
**Surface drift:** Card в `vps.$vpsId.tsx`, `resources.tsx`, `renewals.tsx`, `domain/charts.tsx`, `integrations/app-switcher-editor.tsx`. shadcn Table в `spaces.tsx`.  
**Dashboard QA:** contract: VPS order = banner → KPI → charts → attention → QuickActionGrid (исключение vs EvoBGP KPI → QA → rest).  
**Preserve:** VPS CRUD, BILLmanager sync, тарифы, баланс, платежи, topology canvas, CSV export, фильтры отчётов.

---

## 8. UX/UI Audit — Cloudflare Domain Manager

**Identity:** Vite SPA, `@cfdm/ui`, Frame-first. Card **не** импортируется в `apps/web` (grep 0). Ближе всех к контракту.  
**Routes:** index, domains, `domains/$domainId`, DNS, services, groups, `groups/$groupId`, certificates, settings (index/appearance/integrations).  
**Kit:** + `kanban-board`, `dashboard-analytics`. Нет `frame-data-grid` отдельным файлом (`<uncertain>` — может быть внутри ResourcePage).  
**Gaps:** нет `AGENTS.md`; нет `ui-surface.ts`; naming `*KpiCards` (`domain-kpi-cards.tsx`, `cert-kpi-cards.tsx`, `service-kpi-cards.tsx`) при том что внутри уже `KpiStatGrid`; KPI tiles = Item hybrid, не IconTile.  
**Preserve:** DNS CRUD, Cloudflare certs, groups/services kanban, integrations.

---

## 9. UX/UI Audit — EvoBGP

**Identity:** KPI SoT. `@evobgp/ui`. `lib/ui-surface.ts` есть.  
**Routes:** dashboard, modules, `modules/$moduleId`, `modules/new`, lookup, network, operations, monitoring, directories, schedule, settings, tenant-settings, access.  
**Card leftovers:** `modules/new.tsx`, `illustrated-empty-state.tsx`, `kpi-sparkline-card.tsx`, examples `c-tabs-*`.  
**Kit unused:** `SettingsShell` определён в `reui-kit/settings-shell.tsx`, **не** импортируется routes (grep только definition).  
**Forms:** WEB-05 требует RHF; фактическое использование в `src` — `<uncertain>` / выравнивать на Field + sheet-8.  
**Preserve:** modules CRUD, lookup, BIRD jobs, network, access keys.

---

## 10. UX/UI Audit — Auth Portal

**Identity:** IdP, не ops CRUD. Login: `routes/index.tsx` → `PortalLoginForm` на базе **auth-18** (`components/blocks/auth-18/...`).  
**`_auth` routes:** apps, admin users, user detail, oidc, logins, audit, admin apps.  
**Chrome gap:** `site-header.tsx` — только `AppsMenu`, **нет** `SystemMonitorPopover` (grep 0 по репо).  
**Kit:** `ResourcePage` — stub types only (`reui-kit/resource-page.tsx`). `/apps` — hand-roll Frame tiles, не `QuickActionGrid`.  
**Contract vs code:** `docs/ui-design-contract.md` ids без `dns`; `APP_IDS` включает `dns`.  
**Preserve:** SSO JWT, OIDC authorize/token/userinfo, app switcher admin, user access, audit.

---

## 11. UX/UI Audit — EvoFirewall

**Identity:** `@evofw/ui`. Chrome: `site-header.tsx` AppsMenu + SystemMonitor.  
**Routes:** index, agents, `agents/$id`, lists, `lists/$id`, rules, `rules/$setId`, stats, settings.  
**SettingsShell:** файл есть, **не** используется routes (grep 0 в routes). `/settings` — PageShell + Frame (допустимо как REPLACE rule).  
**AgentPlatformIcon:** Item `size-10.5` `bg-muted` (`agents/agent-platform-icon.tsx`) — та же устаревшая KPI DNA.  
**Agent cards view:** Frame domain (`?view=cards|table`) — **оставить**, не Card.  
**Preserve:** agent fleet, blocklists, policy rules, stats, EvoBGP prefix ingest.

---

## 12. UX/UI Audit — MikrotikManager

**Identity:** Next.js 16, `components.json` с `@reui`, **нет** `reui-kit`. SoT UI: `app/(main)/servers/page.tsx` + `DataPageCard` → `Card` (`components/data-page-card.tsx`).  
**Pages (27):** servers, dashboard, firewall, filters, certificates, gre, data-collection, uptime, recursive-routes, route-optimizer, ospf, communities, settings, probes, vxlan, wireguard, backups, bgp, ip-ranges, domains, asns, alerts, network-map, terminal, traffic, releases, containers.  
**ReUI on disk:** frame, filters, badge, alert, autocomplete, number-field, sortable, timeline, stepper + data-grid (partial). `frame.tsx` установлен, ops-shell его не использует.  
**Chrome:** sidebar `16rem`; footer hand-roll + Sun/Moon; `NavUser` файл есть, не подключён; нет App Switcher / AppsMenu / SystemMonitor; `SidebarRail` включён.  
**Theme:** `components/theme-provider.tsx` STORAGE_KEY `rl-theme` — не next-themes; UX должен стать 3-way segmented.  
**Preserve:** весь CRUD `/servers` и остальные 26 страниц (terminal, network-map, контейнеры, BGP/OSPF/firewall…). Framework остаётся Next.js.

---

## 13. Cross-project Inconsistency Matrix

| Area | VPS | CFDM | EvoBGP | Auth | FW | MM | UX impact | Priority | Target |
|---|---|---|---|---|---|---|---|---|---|
| Ops surface | mixed Card | Frame | leftover Card | Frame | Frame | **Card SoT** | две системы | P0/P1 | Frame |
| Chrome identity | close | close | close | no monitor | close | **none** | разный «дом» | P0 | Chrome spec |
| Sidebar width | 240px | 240px | 240px | 240px | 240px | 16rem | визуальный разрыв | P0 | 240px |
| Theme control | NavUser segmented | same | same | same | same | Sun/Moon | разный UX | P0 | segmented |
| KPI tile | Item hybrid | Item hybrid | Item hybrid SoT | Item | Item / AgentPlatformIcon | Card KPI | нет IconTile | P1 | IconTile elevated |
| Lists | ResourcePage; spaces Table | ResourcePage | ResourcePage | stub + Frame grids | ResourcePage | DataPageCard | MM/VPS spaces | P1 | DataGrid+Filters |
| Quick Actions | kit (order exception) | kit | kit | hand-roll `/apps` | kit | `<not_found>` | Auth/MM | P1 | QuickActionGrid |
| Settings | SettingsShell | Frame settings | unused SettingsShell | N/A portal | unused SettingsShell | Card settings | dead kit | P2 | settings-3/16 |
| Empty | EmptyState | EmptyState | Card illustrated | Frame empty `/apps` | EmptyState | EmptyState Card-ish | Card empty | P2 | empty-state-14/12 |
| Package UI | `@cfdm/ui` | `@cfdm/ui` | `@evobgp/ui` | `@authportal/ui` | `@evofw/ui` | `@/components/ui` | не сливать npm | — | KEEP scopes |

---

## 14. Duplicate Components Analysis

| Task | Copies | Diff | Unify? | REUI |
|---|---|---|---|---|
| `KpiStatGrid` | 5 Vite repos | import scope only (SoT EvoBGP) | DNA sync per repo, **не** monorepo package | REUI-004 + REUI-005 |
| `QuickActionGrid` | 5 Vite | same | same | REUI-013 |
| `ResourcePage` | 4 ops + Auth stub | Auth stub | implement or stop claiming | REUI-006 |
| `OpsDashboard` | VPS/CFDM/BGP/FW | similar | KEEP per repo | REUI-014 |
| `SettingsShell` | VPS/CFDM/BGP/FW | BGP/FW unused | wire or stop listing as used | REUI-007 |
| `SystemMonitorPopover` | 4 Vite; Auth/MM missing | copy per app | port to Auth + MM | REUI-011 |
| `DataPageCard` vs Frame | MM only vs Vite Frame | Card vs Frame | REPLACE MM | REUI-001 |
| Item KPI tile vs IconTile | 5 Vite + FW AgentPlatformIcon | hand-roll | REPLACE with IconTile | REUI-005 |

Общий npm-пакет kit **не** входит в этот план (package boundaries = technical risk).

---

## 15. REUI PRO Reference Registry

| Ref ID | Component/Block | Official Documentation | Official Example | Used By | Match |
|---|---|---|---|---|---|
| REUI-001 | Frame | [docs/components/base/frame](https://reui.io/docs/components/base/frame) | [components/frame](https://reui.io/components/frame) | CHANGE-009–018, 027 | 1:1 ops surface |
| REUI-002 | Data Grid | [docs/components/base/data-grid](https://reui.io/docs/components/base/data-grid) | [components/data-grid](https://reui.io/components/data-grid) | CHANGE-013, 018 | 1:1 lists; docs = TanStack **v9** vs installed v8 → adaptation = **partial** until migration |
| REUI-003 | Filters | [docs/components/base/filters](https://reui.io/docs/components/base/filters) | [components/filters](https://reui.io/components/filters) | CHANGE-013, 018 | 1:1 |
| REUI-004 | stats-12 | [blocks](https://reui.io/blocks) | [preview/base/stats-12](https://reui.io/preview/base/stats-12) | CHANGE-005, 008 | **partial** (MCP: Frame+Badge+Item; kit hand-rolls Item) |
| REUI-005 | Icon Tile | [docs/components/base/icon-tile](https://reui.io/docs/components/base/icon-tile) | [components/icon-tile](https://reui.io/components/icon-tile) | CHANGE-004, 005, 007, 008 | 1:1 for tile primitive (`variant="elevated"` per docs) |
| REUI-006 | data-grid-filtering-2 | [blocks](https://reui.io/blocks) | [preview/base/data-grid-filtering-2](https://reui.io/preview/base/data-grid-filtering-2) | CHANGE-013, 018, 021 | **partial** (kit ResourcePage) |
| REUI-007 | settings-16 | [blocks/application/settings](https://reui.io/blocks/application/settings) | [preview/base/settings-16](https://reui.io/preview/base/settings-16) | CHANGE-020 | 1:1 integrations |
| REUI-008 | settings-3 | [blocks](https://reui.io/blocks) | [preview/base/settings-3](https://reui.io/preview/base/settings-3) | CHANGE-020 | 1:1 settings rows Frame |
| REUI-009 | settings-8 | [blocks](https://reui.io/blocks) | [preview/base/settings-8](https://reui.io/preview/base/settings-8) | CHANGE-020 | 1:1 webhook-like lists |
| REUI-010 | app-shell-12 | [blocks](https://reui.io/blocks) | [preview/base/app-shell-12](https://reui.io/preview/base/app-shell-12) | CHANGE-001, 002, 003 | **partial** (chrome composition) |
| REUI-011 | app-shell-7 | [blocks](https://reui.io/blocks) | [preview/base/app-shell-7](https://reui.io/preview/base/app-shell-7) | CHANGE-001, 002 | **partial** (SystemMonitor popover match) |
| REUI-012 | app-shell-1 | [blocks](https://reui.io/blocks) | [preview/base/app-shell-1](https://reui.io/preview/base/app-shell-1) | CHANGE-002, 032 | **partial** (NavUser) |
| REUI-013 | card-12 | [blocks](https://reui.io/blocks) | [preview/base/card-12](https://reui.io/preview/base/card-12) | CHANGE-022 | **partial** (Quick Actions DNA; name «card» но Frame tiles) |
| REUI-014 | dashboard-1 | [blocks](https://reui.io/blocks) | [preview/base/dashboard-1](https://reui.io/preview/base/dashboard-1) | CHANGE-008, 029 | **partial** (OpsDashboard) |
| REUI-015 | empty-state-14 | [blocks](https://reui.io/blocks) | [preview/base/empty-state-14](https://reui.io/preview/base/empty-state-14) | CHANGE-016, 030 | 1:1 Frame empty (MCP `surface: frame`) |
| REUI-016 | empty-state-12 | [blocks](https://reui.io/blocks) | [preview/base/empty-state-12](https://reui.io/preview/base/empty-state-12) | CHANGE-030 | **partial** (current cite; MCP surface none) |
| REUI-017 | sheet-8 | [blocks](https://reui.io/blocks) | [preview/base/sheet-8](https://reui.io/preview/base/sheet-8) | CHANGE-031 | **partial** (settings sheet; surface none) |
| REUI-018 | sheet-1 | [blocks](https://reui.io/blocks) | [preview/base/sheet-1](https://reui.io/preview/base/sheet-1) | CHANGE-031 | **partial** (create sheet) |
| REUI-019 | sheet-9 | [blocks](https://reui.io/blocks) | [preview/base/sheet-9](https://reui.io/preview/base/sheet-9) | CHANGE-031 | **partial** (detail sheet) |
| REUI-020 | auth-13 | [blocks](https://reui.io/blocks) | [preview/base/auth-13](https://reui.io/preview/base/auth-13) | Auth login **не** target (см. REUI-021) | 1:1 Frame login **если** менять; сейчас KEEP auth-18 |
| REUI-021 | auth-18 | [blocks](https://reui.io/blocks) | [preview/base/auth-18](https://reui.io/preview/base/auth-18) | Auth login actual | **partial** (surface none; split testimonial) |
| REUI-022 | solution-users-1 | [blocks](https://reui.io/blocks) | [preview/base/solution-users-1](https://reui.io/preview/base/solution-users-1) | Auth admin users | **partial** (Frame+DataGrid+Filters+Sheet) |
| REUI-023 | form-7 | [blocks](https://reui.io/blocks) | [preview/base/form-7](https://reui.io/preview/base/form-7) | CHANGE-031 | **partial** (inline Frame form) |
| REUI-024 | chart-15 | [blocks](https://reui.io/blocks) | [preview/base/chart-15](https://reui.io/preview/base/chart-15) | CHANGE-012 | 1:1 Frame charts (MCP `surface: frame`) |
| REUI-025 | settings-2 | [blocks](https://reui.io/blocks) | [preview/base/settings-2](https://reui.io/preview/base/settings-2) | CHANGE-020 | 1:1 mixed-control rows Frame |
| REUI-026 | c-tabs-2 | [components/tabs](https://reui.io/components/tabs) | [preview/base/components/c-tabs-2](https://reui.io/preview/base/components/c-tabs-2) | ResourcePage tabs | **partial** (line tabs; example also lists Card) |
| REUI-027 | Alert Dialog example | [components/alert-dialog](https://reui.io/components/alert-dialog) | [c-alert-dialog-11](https://reui.io/preview/base/components/c-alert-dialog-11) | CHANGE-031 confirm | **partial** (shadcn AlertDialog + ReUI example) |
| REUI-028 | Icon Stack | [docs/components/base/icon-stack](https://reui.io/docs/components/base/icon-stack) | [components/icon-stack](https://reui.io/components/icon-stack) | CHANGE-016, 030 | 1:1 empty illustration |
| REUI-029 | Badge | [docs/components/base/badge](https://reui.io/docs/components/base/badge) | [components/badge](https://reui.io/components/badge) | KPI/QA status | 1:1 semantic variants |
| REUI-030 | Alert | [docs/components/base/alert](https://reui.io/docs/components/base/alert) | [components/alert](https://reui.io/components/alert) | errors | 1:1 |
| REUI-031 | Kanban | [docs/components/base/kanban](https://reui.io/docs/components/base/kanban) | [components/kanban](https://reui.io/components/kanban) | CFDM groups/services | 1:1 domain |
| REUI-032 | Sortable | [docs/components/base/sortable](https://reui.io/docs/components/base/sortable) | [components/sortable](https://reui.io/components/sortable) | FW policy | 1:1 domain |
| REUI-033 | Stepper | [docs/components/base/stepper](https://reui.io/docs/components/base/stepper) | [components/stepper](https://reui.io/components/stepper) | MM/FW if used | 1:1; FW unused → don't list as used |
| REUI-034 | Timeline | [docs/components/base/timeline](https://reui.io/docs/components/base/timeline) | [components/timeline](https://reui.io/components/timeline) | audit | 1:1 |
| REUI-035 | Autocomplete | [docs/components/base/autocomplete](https://reui.io/docs/components/base/autocomplete) | [components/autocomplete](https://reui.io/components/autocomplete) | domain pickers | 1:1 |

**Не target (намеренно):**

| Item | Why | Evidence |
|---|---|---|
| settings-7 | MCP `surface: card` | [preview/base/settings-7](https://reui.io/preview/base/settings-7) |
| empty-state-11 | MCP `surface: card` | [preview/base/empty-state-11](https://reui.io/preview/base/empty-state-11) |

---

## 16. Target UX/UI Rules

### TARGET-RULE-001

**Rule:** Один surface на ops-экран: ReUI Frame. Не смешивать Card и Frame.  
**Scope:** все 6.  
**Rationale:** две системы ломают consistency.  
**REUI PRO:** [Frame](https://reui.io/docs/components/base/frame)  
**Impact:** VPS Card pages, BGP leftovers, MM DataPageCard.

### TARGET-RULE-002

**Rule:** Ops-списки = DataGrid + Filters внутри Frame. Запрет raw `<table>` / shadcn Table как ops list.  
**Scope:** все 6.  
**REUI PRO:** [data-grid](https://reui.io/docs/components/base/data-grid) · [data-grid-filtering-2](https://reui.io/preview/base/data-grid-filtering-2)  
**Impact:** VPS `spaces.tsx`; MM DataPageCard.

### TARGET-RULE-003

**Rule:** KPI = stats-12 composition + IconTile `elevated` (не hand-roll Item `size-10.5`). Semantic `text-*` / Badge, не `bg-emerald-*`.  
**Scope:** kit во всех Vite + MM dashboard.  
**REUI PRO:** [stats-12](https://reui.io/preview/base/stats-12) · [icon-tile](https://reui.io/docs/components/base/icon-tile)

### TARGET-RULE-004

**Rule:** Quick Actions = только `QuickActionGrid` (Frame tiles, sibling KPI).  
**REUI PRO:** [stats-12](https://reui.io/preview/base/stats-12) · [card-12](https://reui.io/preview/base/card-12)

### TARGET-RULE-005

**Rule:** Settings rows = settings-3 / settings-2; integrations = settings-16; **запрет settings-7**.  
**REUI PRO:** [settings-3](https://reui.io/preview/base/settings-3) · [settings-16](https://reui.io/preview/base/settings-16)

### TARGET-RULE-006 (P0)

**Rule:** Chrome identity 1:1 во всех 6 — см. Chrome Identity Spec. Auth Portal и MikrotikManager **не** исключение. Login без AppShell.  
**REUI PRO:** [app-shell-12](https://reui.io/preview/base/app-shell-12) · [app-shell-7](https://reui.io/preview/base/app-shell-7) · [app-shell-1](https://reui.io/preview/base/app-shell-1)

### TARGET-RULE-007

**Rule:** Create/edit = Sheet (sheet-8 / sheet-1 / sheet-9). Confirm = Alert Dialog ([c-alert-dialog-11](https://reui.io/preview/base/components/c-alert-dialog-11)).

### TARGET-RULE-008

**Rule:** Empty = Empty + IconStack, Frame-friendly empty-state-14 (prefer) / empty-state-12. Не empty-state-11.

### TARGET-RULE-009

**Rule:** MikrotikManager UX SoT: Frame+DataGrid **при сохранении** CRUD `/servers`. Next.js не менять.

### TARGET-RULE-010

**Rule:** Rules синхронизировать с диском (не перечислять неустановленные компоненты как установленные). App Switcher ids включают `dns`.

---

### RULE-CHANGE-001

**Current rule:** SoT UI = `/servers` на Card (`next-shadcn-production.mdc`, `ma-ui-guardian.mdc`).  
**Source:** `MikrotikManager-3/.cursor/rules/next-shadcn-production.mdc`  
**Problem:** блокирует унификацию Frame.  
**Evidence:** `components/data-page-card.tsx` → `Card`.  
**Recommended:** SoT = Frame + DataGrid; `/servers` остаётся эталоном **поведения** CRUD, не Card-shell.  
**REUI:** REUI-001, REUI-006.  
**Impact:** MM rules + все `DataPageCard` pages.

### RULE-CHANGE-002

**Current:** kpi-hybrid Item `size-10.5` `bg-muted`.  
**Source:** `kpi-hybrid.mdc` ×5.  
**Problem:** official IconTile покрывает задачу; нигде не установлен.  
**Recommended:** KPI/row tiles = IconTile `elevated` + stats-12 composition.  
**REUI:** REUI-004, REUI-005.

### RULE-CHANGE-003

**Current:** chrome описан в contract, но Auth/MM исключения фактически существуют.  
**Recommended:** Chrome Identity Spec обязателен 1:1 для всех 6.  
**REUI:** REUI-010, REUI-011, REUI-012.

### RULE-CHANGE-004

**Current:** contract App Switcher ids без `dns`.  
**Source:** `auth-portal/docs/ui-design-contract.md`  
**Evidence:** `APP_IDS` включает `dns`.  
**Recommended:** ids `cfdm · vps · bgp · fw · dns`.

### RULE-CHANGE-005

**Current:** VPS `frontend-shadcn.mdc` / `reui-mcp.mdc` lists `kanban-board`.  
**Evidence:** `reui-kit/` VPS — нет `kanban-board.tsx`; grep `kanban` в VPS = 0.  
**Recommended:** список установленных = диск.

### RULE-CHANGE-006

**Current:** settings-7 встречается как reference.  
**Evidence:** MCP settings-7 `surface: card`.  
**Recommended:** запретить как target.

---

## 17. Detailed Change Plan

Шаблон ниже. Functional requirements для всех UI CHANGE: сохранить create/edit/delete/filter/sort/pagination/navigation/permissions; менять только оболочку.

Состояния (где применимо): default, hover, focus, disabled, loading, error, empty.  
Responsive: desktop = эталон ReUI preview; tablet/mobile = существующий Sidebar/Sheet collapse Vite/Next, не ломать.  
A11y: keyboard, focus ring, labels, `aria-hidden` на decorative IconTile (docs).

### CHANGE-001

**Project:** Auth Portal · **Priority:** P0 · **Category:** Navigation / chrome  
**File:** `apps/web/src/components/layout/site-header.tsx`  
**Current:** header right = только `AppsMenu` (строки 73–75).  
**Problem:** нет SystemMonitor — ломает chrome identity.  
**Change:** добавить `SystemMonitorPopover` после AppsMenu (порт с CFDM/VPS).  
**Ref:** REUI-011 · [app-shell-7](https://reui.io/preview/base/app-shell-7) · Match: **partial**  
**Mapping:** AppsMenu-only header → AppsMenu + SystemMonitor.  
**Preserve:** breadcrumbs, AppsMenu, SSO session.  
**Risk:** Low.

### CHANGE-002

**Project:** MikrotikManager · **Priority:** P0 · **Category:** Navigation / chrome  
**Files:** `components/app-sidebar.tsx`, `components/ui/sidebar.tsx`, `(main)/layout.tsx`  
**Current:** sidebar 16rem; footer hand-roll + Sun/Moon; SidebarRail; нет AppsMenu/SystemMonitor/App Switcher.  
**Change:** Chrome Identity Spec 1:1 (240px, Switcher, NavUser segmented, header cluster, убрать Rail и icon theme toggle).  
**Ref:** REUI-010, REUI-011, REUI-012  
**Match:** **partial** (composition, Next layout).  
**Preserve:** nav groups, command palette **как ⌘K** (не Search pill в header).  
**Risk:** High.

### CHANGE-003

**Project:** VPS, CFDM, EvoBGP, EvoFirewall · **Priority:** P0 · **Category:** chrome verification  
**Current:** близко к spec (SystemMonitor есть).  
**Change:** pixel/token сверка 1:1 (header `h-12`, main padding, нет ModeToggle/Search pill).  
**Ref:** REUI-010 · Match: **partial**  
**Risk:** Low.

### CHANGE-004

**Project:** все 6 · **Priority:** P1 · **Category:** KPI primitive install  
**Current:** `icon-tile` отсутствует.  
**Change:** CLI `pnpm dlx shadcn@latest add @reui/icon-tile --yes` из `apps/web` (MM — из корня Next).  
**Ref:** REUI-005 · [icon-tile docs](https://reui.io/docs/components/base/icon-tile) · Match: **1:1**  
**Risk:** Low.

### CHANGE-005

**Project:** 5 Vite kit · **Priority:** P1 · **Category:** KPI  
**Files:** `reui-kit/kpi-stat-grid.tsx` (каждый репо); EvoBGP SoT markup.  
**Current:** `Item` `size-10.5` `bg-muted` + `ItemMedia`.  
**Change:** IconTile `elevated` + stats-12 composition; обновить `kpi-hybrid.mdc`.  
**Ref:** REUI-004 **partial** + REUI-005 **1:1**  
**Preserve:** `to`/`onSelect`, variants warning/destructive, Badge hints.  
**Risk:** Medium (visual DNA shift).

### CHANGE-006

**Project:** CFDM · **Priority:** P2 · **Category:** naming  
**Files:** `domain-kpi-cards.tsx`, `cert-kpi-cards.tsx`, `service-kpi-cards.tsx`  
**Change:** переименовать `*KpiCards` → `*KpiStats` (внутри уже KpiStatGrid). Не Card.  
**Ref:** REUI-004 · Match: **partial** (rename only)  
**Risk:** Low.

### CHANGE-007

**Project:** EvoFirewall · **Priority:** P1 · **Category:** row tiles  
**File:** `apps/web/src/components/agents/agent-platform-icon.tsx`  
**Current:** Item hybrid tile.  
**Change:** IconTile elevated; semantic `text-info` / muted.  
**Ref:** REUI-005 · Match: **1:1**  
**Preserve:** mikrotik vs linux aria-label.  
**Risk:** Low.

### CHANGE-008

**Project:** MikrotikManager · **Priority:** P1 · **Category:** KPI  
**File:** `app/(main)/dashboard/page.tsx`  
**Change:** dashboard metrics → stats-12 + IconTile, не Card KPI.  
**Ref:** REUI-004, REUI-005, REUI-014 · Match: **partial**  
**Preserve:** dashboard numbers/links.  
**Risk:** Medium.

### CHANGE-009

**Project:** VPS Tracker · **Priority:** P1 · **Category:** Surface  
**File:** `apps/web/src/routes/_auth/vps.$vpsId.tsx`  
**Current:** Card shells.  
**Change:** Frame / DetailPanel.  
**Ref:** REUI-001, REUI-023 · Match: **partial** (detail composition)  
**Preserve:** VPS detail fields, actions, sync.  
**Risk:** Medium.

### CHANGE-010

**Project:** VPS Tracker · **Priority:** P1 · **Category:** Surface  
**File:** `apps/web/src/routes/_auth/resources.tsx`  
**Change:** Card → Frame.  
**Ref:** REUI-001 · Match: **1:1** shell  
**Preserve:** resource listing.  
**Risk:** Low.

### CHANGE-011

**Project:** VPS Tracker · **Priority:** P1 · **Category:** Surface  
**File:** `apps/web/src/routes/_auth/renewals.tsx`  
**Change:** Card → Frame.  
**Ref:** REUI-001 · Match: **1:1** shell  
**Preserve:** renewals data/actions.  
**Risk:** Low.

### CHANGE-012

**Project:** VPS Tracker · **Priority:** P1 · **Category:** Charts  
**File:** `apps/web/src/components/domain/charts.tsx` (used by `reports.tsx`)  
**Current:** Card from `@cfdm/ui/components/card`.  
**Change:** Frame chart shells per chart-15.  
**Ref:** REUI-024 · [chart-15](https://reui.io/preview/base/chart-15) · Match: **1:1** surface; **partial** series (Recharts already)  
**Preserve:** filters, CSV, KPI on reports.  
**Risk:** Medium.

### CHANGE-013

**Project:** VPS Tracker · **Priority:** P1 · **Category:** Data UI  
**File:** `apps/web/src/routes/_auth/spaces.tsx`  
**Current:** shadcn Table.  
**Change:** ResourcePage / DataGrid + Filters.  
**Ref:** REUI-002 **partial** (v8), REUI-003, REUI-006  
**Preserve:** spaces CRUD, columns, sort.  
**Risk:** Medium.

### CHANGE-014

**Project:** VPS Tracker · **Priority:** P2 · **Category:** Settings  
**File:** `apps/web/src/components/integrations/app-switcher-editor.tsx`  
**Current:** Card.  
**Change:** Frame + settings-16/3 rows.  
**Ref:** REUI-001, REUI-007 · Match: **partial**  
**Preserve:** app switcher editor fields.  
**Risk:** Low.

### CHANGE-015

**Project:** EvoBGP · **Priority:** P1 · **Category:** Surface  
**File:** `apps/web/src/routes/_auth/modules/new.tsx`  
**Current:** Card stub.  
**Change:** Frame + sheet-1/form-7 for create.  
**Ref:** REUI-001, REUI-018 · Match: **partial**  
**Preserve:** module create flow.  
**Risk:** Medium.

### CHANGE-016

**Project:** EvoBGP · **Priority:** P1 · **Category:** Empty  
**File:** `apps/web/src/components/patterns/illustrated-empty-state.tsx`  
**Current:** Card + illustration.  
**Change:** empty-state-14 (Frame + IconStack).  
**Ref:** REUI-015, REUI-028 · Match: **1:1** surface  
**Preserve:** empty CTA copy/actions.  
**Risk:** Low.

### CHANGE-017

**Project:** EvoBGP · **Priority:** P2 · **Category:** Charts  
**File:** `apps/web/src/components/patterns/kpi-sparkline-card.tsx`  
**Change:** Card → Frame / chart-15 DNA.  
**Ref:** REUI-024 · Match: **partial**  
**Risk:** Low.

### CHANGE-018

**Project:** MikrotikManager · **Priority:** P1 · **Category:** Surface  
**Files:** `components/data-page-card.tsx` + all pages importing it (servers, firewall, filters, gre, certificates, data-collection, …).  
**Current:** `Card`. `components/reui/frame.tsx` установлен, не используется как ops shell.  
**Change:** DataPageCard → Frame wrapper (или заменить вызовы на Frame).  
**Ref:** REUI-001, REUI-006 · Match: **1:1** shell; grid **partial** (v8)  
**Preserve:** весь CRUD `/servers` и остальных страниц.  
**Risk:** High.

### CHANGE-019

**Project:** EvoBGP · **Priority:** P2 · **Category:** Kit dead code  
**File:** `reui-kit/settings-shell.tsx`  
**Change:** подключить на settings routes **или** убрать из «установленный kit / used».  
**Ref:** REUI-007, REUI-008 · Match: **partial**  
**Risk:** Low.

### CHANGE-020

**Project:** EvoFirewall · **Priority:** P2 · **Category:** Settings  
**File:** `routes/_auth/settings.tsx` vs unused `reui-kit/settings-shell.tsx`  
**Change:** либо SettingsShell при 2+ секциях, либо явно REPLACE rule «single-page = PageShell+Frame» (уже в FW frontend-shadcn).  
**Ref:** REUI-007, REUI-008, REUI-025  
**Risk:** Low.

### CHANGE-021

**Project:** Auth Portal · **Priority:** P2 · **Category:** Kit  
**File:** `reui-kit/resource-page.tsx` (stub)  
**Change:** либо реализовать как ops ResourcePage, либо не экспортировать как list kit. Admin users → solution-users-1 DNA.  
**Ref:** REUI-006, REUI-022 · Match: **partial**  
**Preserve:** users/OIDC grids.  
**Risk:** Medium.

### CHANGE-022

**Project:** Auth Portal · **Priority:** P1 · **Category:** Quick Actions  
**File:** `apps/web/src/routes/_auth.apps.tsx`  
**Current:** hand-roll Frame tiles.  
**Change:** `QuickActionGrid` (после IconTile DNA).  
**Ref:** REUI-013, REUI-004 · Match: **partial**  
**Preserve:** SSO `openApp`, admin link, empty «нет приложений».  
**Risk:** Medium.

### CHANGE-023

**Project:** Auth Portal · **Priority:** P1 · **Category:** Rules  
**File:** `docs/ui-design-contract.md` (+ копии в других apps)  
**Change:** App Switcher ids += `dns`.  
**Ref:** N/A functional; chrome REUI-010  
**Match:** `<not_found_in_reui>` для списка ids (доменное) — UI chrome всё равно REUI-010.  
**Risk:** Low.

### CHANGE-024

**Project:** CFDM · **Priority:** P2 · **Category:** Rules  
**Change:** добавить `AGENTS.md` + `apps/web/src/lib/ui-surface.ts` (`UI_SURFACE = 'frame'`), как EvoBGP.  
**Ref:** REUI-001  
**Risk:** Low.

### CHANGE-025

**Project:** VPS Tracker · **Priority:** P2 · **Category:** Rules  
**Change:** убрать kanban из «установленных» в `reui-mcp.mdc` / `frontend-shadcn.mdc`.  
**Ref:** REUI-031 существует, но **не установлен** в VPS.  
**Risk:** Low.

### CHANGE-026

**Project:** all Vite · **Priority:** P1 · **Category:** Rules  
**Files:** `kpi-hybrid.mdc` ×5 + workspace `reui-pro-senior-frontend.mdc`  
**Change:** DNA = IconTile elevated, не Item.  
**Ref:** REUI-005  
**Risk:** Low (docs only until CHANGE-005).

### CHANGE-027

**Project:** MikrotikManager · **Priority:** P0 · **Category:** Rules  
**Change:** RULE-CHANGE-001 — SoT Frame+DataGrid.  
**Ref:** REUI-001, REUI-006  
**Risk:** High (process + UI).

### CHANGE-028

**Project:** EvoBGP (+ any settings-7 cite) · **Priority:** P1 · **Category:** Rules  
**Change:** запрет settings-7 как target.  
**Ref:** settings-7 [preview](https://reui.io/preview/base/settings-7) — **не использовать**. Target REUI-007/008.  
**Risk:** Low.

### CHANGE-029

**Project:** VPS Tracker · **Priority:** P2 · **Category:** Dashboard layout  
**Current:** contract exception QA after charts.  
**Change:** либо выровнять с EvoBGP (KPI → QA → rest), либо **явно** оставить exception в contract. Решение implementation: default **KEEP exception** unless product asks otherwise.  
**Ref:** REUI-014 · Match: **partial**  
**Risk:** Low.

### CHANGE-030

**Project:** all 6 · **Priority:** P2 · **Category:** Empty states  
**Change:** Frame-friendly empty-state-14/12 + IconStack; не Card empty-state-11.  
**Ref:** REUI-015, REUI-016, REUI-028  
**Risk:** Low.

### CHANGE-031

**Project:** all 6 · **Priority:** P2 · **Category:** Forms / overlays  
**Change:** create/edit Sheet per sheet-8/1/9; confirm c-alert-dialog-11. Не менять validation/API.  
**Ref:** REUI-017, REUI-018, REUI-019, REUI-023, REUI-027  
**Risk:** Medium.

### CHANGE-032

**Project:** MikrotikManager · **Priority:** P0 · **Category:** chrome  
**File:** `components/nav-user.tsx` unused  
**Change:** подключить в SidebarFooter; segmented theme вместо Sun/Moon; убрать hardcoded «АК» footer.  
**Ref:** REUI-012 · Match: **partial**  
**Preserve:** user name/email display (сейчас hardcoded — **заменить на реального пользователя**, не потерять logout если появится).  
**Risk:** Medium.

### CHANGE-033

**Project:** MikrotikManager · **Priority:** P1 · **Category:** chrome  
**File:** `components/app-sidebar.tsx` `SidebarRail`  
**Change:** удалить Rail (запрещён контрактом).  
**Ref:** REUI-010 · Match: **partial**  
**Risk:** Low.

### CHANGE-034

**Project:** MikrotikManager · **Priority:** P0 · **Category:** chrome  
**File:** `components/ui/sidebar.tsx` `SIDEBAR_WIDTH = "16rem"`  
**Change:** `240px`.  
**Ref:** REUI-010 · Match: **partial** (token, не block 1:1)  
**Risk:** Medium (layout shift).

---

## Final Change Matrix

| Change ID | Project | Category | Priority | Current UI | Target REUI PRO | Ref ID | Official Reference | Match |
|---|---|---|---|---|---|---|---|---|
| CHANGE-001 | Auth Portal | Chrome | P0 | AppsMenu only | app-shell-7 monitor | REUI-011 | [app-shell-7](https://reui.io/preview/base/app-shell-7) | partial |
| CHANGE-002 | MM | Chrome | P0 | 16rem + Sun/Moon | app-shell-12/7/1 | REUI-010 | [app-shell-12](https://reui.io/preview/base/app-shell-12) | partial |
| CHANGE-003 | VPS/CFDM/BGP/FW | Chrome | P0 | close | app-shell-12 | REUI-010 | [app-shell-12](https://reui.io/preview/base/app-shell-12) | partial |
| CHANGE-004 | all 6 | Install | P1 | missing | Icon Tile | REUI-005 | [icon-tile](https://reui.io/docs/components/base/icon-tile) | 1:1 |
| CHANGE-005 | 5 Vite | KPI | P1 | Item hybrid | stats-12 + IconTile | REUI-004/005 | [stats-12](https://reui.io/preview/base/stats-12) | partial + 1:1 |
| CHANGE-006 | CFDM | Naming | P2 | *KpiCards | KpiStatGrid name | REUI-004 | [stats-12](https://reui.io/preview/base/stats-12) | partial |
| CHANGE-007 | FW | Row tile | P1 | Item AgentPlatformIcon | IconTile | REUI-005 | [icon-tile](https://reui.io/docs/components/base/icon-tile) | 1:1 |
| CHANGE-008 | MM | KPI | P1 | Card metrics | stats-12 + IconTile | REUI-004/005 | [stats-12](https://reui.io/preview/base/stats-12) | partial |
| CHANGE-009 | VPS | Surface | P1 | Card detail | Frame | REUI-001 | [frame](https://reui.io/docs/components/base/frame) | partial |
| CHANGE-010 | VPS | Surface | P1 | Card resources | Frame | REUI-001 | [frame](https://reui.io/docs/components/base/frame) | 1:1 |
| CHANGE-011 | VPS | Surface | P1 | Card renewals | Frame | REUI-001 | [frame](https://reui.io/docs/components/base/frame) | 1:1 |
| CHANGE-012 | VPS | Charts | P1 | Card charts | chart-15 | REUI-024 | [chart-15](https://reui.io/preview/base/chart-15) | 1:1/partial |
| CHANGE-013 | VPS | Table | P1 | shadcn Table spaces | DataGrid+Filters | REUI-002/006 | [data-grid](https://reui.io/docs/components/base/data-grid) | partial |
| CHANGE-014 | VPS | Settings | P2 | Card editor | Frame settings-16 | REUI-007 | [settings-16](https://reui.io/preview/base/settings-16) | partial |
| CHANGE-015 | EvoBGP | Surface | P1 | Card new module | Frame/sheet-1 | REUI-001/018 | [sheet-1](https://reui.io/preview/base/sheet-1) | partial |
| CHANGE-016 | EvoBGP | Empty | P1 | Card empty | empty-state-14 | REUI-015 | [empty-state-14](https://reui.io/preview/base/empty-state-14) | 1:1 |
| CHANGE-017 | EvoBGP | Charts | P2 | Card sparkline | chart-15 | REUI-024 | [chart-15](https://reui.io/preview/base/chart-15) | partial |
| CHANGE-018 | MM | Surface | P1 | DataPageCard Card | Frame+DataGrid | REUI-001/006 | [frame](https://reui.io/docs/components/base/frame) | 1:1/partial |
| CHANGE-019 | EvoBGP | Kit | P2 | unused SettingsShell | settings-16/3 | REUI-007 | [settings-16](https://reui.io/preview/base/settings-16) | partial |
| CHANGE-020 | FW | Settings | P2 | unused SettingsShell | settings-3/16 | REUI-008 | [settings-3](https://reui.io/preview/base/settings-3) | partial |
| CHANGE-021 | Auth | Kit | P2 | ResourcePage stub | data-grid-filtering-2 / users-1 | REUI-006/022 | [users-1](https://reui.io/preview/base/solution-users-1) | partial |
| CHANGE-022 | Auth | QA | P1 | hand-roll /apps | QuickActionGrid | REUI-013 | [card-12](https://reui.io/preview/base/card-12) | partial |
| CHANGE-023 | Auth | Rules | P1 | contract без dns | ids + dns | REUI-010 | [app-shell-12](https://reui.io/preview/base/app-shell-12) | partial |
| CHANGE-024 | CFDM | Rules | P2 | no AGENTS.md | Frame lock file | REUI-001 | [frame](https://reui.io/docs/components/base/frame) | 1:1 |
| CHANGE-025 | VPS | Rules | P2 | fake kanban installed | disk-accurate list | REUI-031 | [kanban](https://reui.io/docs/components/base/kanban) | 1:1 exists, unused |
| CHANGE-026 | Vite | Rules | P1 | Item hybrid rule | IconTile rule | REUI-005 | [icon-tile](https://reui.io/docs/components/base/icon-tile) | 1:1 |
| CHANGE-027 | MM | Rules | P0 | Card SoT | Frame SoT | REUI-001 | [frame](https://reui.io/docs/components/base/frame) | 1:1 |
| CHANGE-028 | EvoBGP | Rules | P1 | settings-7 cite | forbid card settings | REUI-007 | [settings-16](https://reui.io/preview/base/settings-16) | 1:1 |
| CHANGE-029 | VPS | Layout | P2 | QA order exception | KEEP or align | REUI-014 | [dashboard-1](https://reui.io/preview/base/dashboard-1) | partial |
| CHANGE-030 | all 6 | Empty | P2 | mixed | empty-state-14/12 | REUI-015 | [empty-state-14](https://reui.io/preview/base/empty-state-14) | 1:1/partial |
| CHANGE-031 | all 6 | Forms | P2 | mixed sheets | sheet-8/1/9 | REUI-017 | [sheet-8](https://reui.io/preview/base/sheet-8) | partial |
| CHANGE-032 | MM | Chrome | P0 | unused NavUser | app-shell-1 NavUser | REUI-012 | [app-shell-1](https://reui.io/preview/base/app-shell-1) | partial |
| CHANGE-033 | MM | Chrome | P1 | SidebarRail | remove | REUI-010 | [app-shell-12](https://reui.io/preview/base/app-shell-12) | partial |
| CHANGE-034 | MM | Chrome | P0 | 16rem | 240px | REUI-010 | [app-shell-12](https://reui.io/preview/base/app-shell-12) | partial |

Все UI-related CHANGE имеют Ref ID. CHANGE-023 ids — доменный список; chrome reference всё равно REUI-010.

### Execution log (2026-08-17)

- [x] CHANGE-001 Auth SystemMonitor
- [x] CHANGE-002 MM chrome identity
- [x] CHANGE-003 Vite chrome verification (240px, h-12, skip-link, main padding)
- [x] CHANGE-004 IconTile CLI во всех 6
- [x] CHANGE-005 KpiStatGrid IconTile DNA
- [x] CHANGE-006 CFDM *KpiStats rename
- [x] CHANGE-007 FW AgentPlatformIcon IconTile
- [x] CHANGE-008 MM dashboard stats-12 + IconTile + Frame panels (`OpsPanel`)
- [x] CHANGE-009 VPS vps detail Frame
- [x] CHANGE-010 VPS resources Frame
- [x] CHANGE-011 VPS renewals Frame
- [x] CHANGE-012 VPS charts Frame
- [x] CHANGE-013 VPS spaces ResourcePage
- [x] CHANGE-014 VPS app-switcher editor Frame
- [x] CHANGE-015 EvoBGP modules/new Frame
- [x] CHANGE-016 EvoBGP empty IconStack
- [x] CHANGE-017 EvoBGP sparkline Frame (chart-15 DNA)
- [x] CHANGE-018 MM DataPageCard + remaining ops Card → Frame/`OpsPanel`
- [x] CHANGE-019 EvoBGP SettingsShell wired
- [x] CHANGE-020 FW single-page settings rule
- [x] CHANGE-021 Auth ResourcePage stub explicit
- [x] CHANGE-022 Auth `/apps` QuickActionGrid
- [x] CHANGE-023 App Switcher ids + `dns`
- [x] CHANGE-024 CFDM AGENTS.md + ui-surface.ts
- [x] CHANGE-025 VPS kanban list disk-accurate
- [x] CHANGE-026 kpi-hybrid IconTile rule
- [x] CHANGE-027 MM SoT Frame+DataGrid
- [x] CHANGE-028 settings-7 не target; live EvoBGP settings → `@/components/settings/*`
- [x] CHANGE-029 VPS QA order KEEP exception (contract)
- [x] CHANGE-030 Empty + IconStack во всех 6
- [x] CHANGE-031 Sheet create/edit + AlertDialog confirm (Vite ConfirmDialog; MM `@shadcn/alert-dialog`; EvoBGP FormDrawer=Sheet)
- [x] CHANGE-032 MM NavUser segmented
- [x] CHANGE-033 MM SidebarRail removed
- [x] CHANGE-034 MM sidebar 240px

RULE-CHANGE-001…006 — DONE (rules files). RULE-CHANGE-007…010 в §2 — опечатка покрытия (в §16 только 001–006).

---

## 18. Implementation Roadmap

### Phase 0 — Discovery

- [x] Tasks: этот файл.  
- [x] DoD: Coverage 100%, Consistency Gate PASS.  
- [x] Аудит зафиксирован 2026-08-17.

### Phase 1 — Chrome identity (все 6)

- [x] CHANGE-001, 002, 003, 032, 033, 034.  
- [x] DoD: Chrome Identity Spec 1:1 (sidebar 240px, Switcher, AppsMenu→monitor, NavUser segmented).

### Phase 2 — Shared rules + IconTile + Frame lock

- [x] CHANGE-004, 026, 027, 028, 024, 025.  
- [x] DoD: `icon-tile` installed; rules updated; MM SoT Frame.

### Phase 3 — Kit DNA

- [x] CHANGE-005, 006, 007, 008, 021, 022.  
- [x] DoD: KpiStatGrid/QuickActionGrid/AgentPlatformIcon на IconTile; Auth `/apps` kit.

### Phase 4 — Page-level Card → Frame

- [x] CHANGE-009–018.  
- [x] DoD: нет Card ops-shell на затронутых страницах; CRUD preserved. MM inner panels → `OpsPanel`.

### Phase 5 — States + sheets

- [x] CHANGE-016, 019, 020, 030, 031.  
- [x] DoD: empty/loading/error Frame-friendly; sheets + AlertDialog.

### Phase 6 — Responsive + a11y verification

- [x] Keyboard skip-link, focus ring tokens, mobile sidebar Sheet RU labels, `aria-expanded`, live regions QueryState.  
- [x] DoD: Acceptance checklist §19.

---

## 19. Acceptance Checklist

### Visual consistency

- [x] Typography unified (theme tokens, не custom fonts per app).
- [x] Buttons unified (shadcn Button hierarchy).
- [x] Inputs unified (Field).
- [x] Forms unified (Sheet + Field).
- [x] Cards unified → **Frame** на ops (Card не ops-shell). MM: `DataPageCard` + `OpsPanel`.
- [x] Tables unified → DataGrid.
- [x] Navigation unified → Chrome Identity Spec.
- [x] Spacing unified → `gap-4 md:gap-6`, main padding.
- [x] States unified (empty IconStack, QueryState live regions).
- [x] Responsive behavior consistent (Sidebar/Sheet collapse + skip-link).

### Functional regression

- [x] Add/Create preserved.
- [x] Delete preserved.
- [x] Edit preserved.
- [x] Save/Cancel preserved.
- [x] Search preserved (⌘K; MM command palette).
- [x] Filter preserved.
- [x] Sort preserved.
- [x] Pagination preserved.
- [x] Navigation preserved.
- [x] Permissions preserved (Auth apps allow-list).
- [x] Form behavior preserved.
- [x] VPS topology canvas preserved (domain, не chrome).
- [x] MM terminal / network-map preserved.

### Accessibility

- [x] Keyboard navigation (skip-link «К содержимому», sidebar trigger).
- [x] Focus states (token `ring-ring`).
- [x] Semantic HTML (один `<main>` = SidebarInset `#main-content`).
- [x] Accessible labels (`aria-hidden` on decorative IconTile per docs).
- [x] Accessible names (`aria-label` AppsMenu / monitor / theme / sidebar).
- [x] Error states (`role="alert"` / ReUI Alert).
- [x] Disabled states (существующие Button/Field disabled).
- [x] Contrast (semantic tokens).

### REUI PRO

- [x] Current official documentation reviewed ([docs](https://reui.io/docs), [llms.txt](https://reui.io/llms.txt)).
- [x] MCP/Skills reviewed (`user-reui`, skill `668fb463eb`).
- [x] Every proposed component verified via `get_block` / `get_component` / `get_example`.
- [x] Every UI-related CHANGE has a REUI PRO Ref ID.
- [x] Every Ref ID has an official URL.
- [x] URLs point to specific relevant documentation.
- [x] Every 1:1 mapping verified (only where structure matches).
- [x] Partial mappings explicitly marked.
- [x] Missing / forbidden components marked (settings-7, empty-state-11).
- [x] No fabricated components / variants / URLs / references.

---

## 20. Risks / Unknowns

| Risk | Level | Notes |
|---|---|---|
| Data Grid TanStack v9 docs vs installed `^8.21.x` | High | Не апгрейдить kit в том же PR, что chrome. `<uncertain>` полный changelog v8→v9. |
| MM DataPageCard blast radius (много page.tsx) | High | Менять обёртку, не бизнес-логику. |
| MM Next vs Vite chrome port | High | Эквивалент UX, не copy-paste Vite files blindly. |
| MM hardcoded footer user | Medium | Нужен реальный user source; `<uncertain>` есть ли auth user в MM UI. |
| Shared kit npm package | Out of scope | Не сливать `@cfdm/ui` / `@evobgp/ui` / … |
| Auth login auth-18 vs rules auth-13 | Low | KEEP auth-18; rules cite auth-13 — documented exception. |
| VPS dashboard QA order | Low | KEEP exception unless product says otherwise. |
| CFDM Card-free claim | Low | grep 0 в `apps/web`; `packages/ui` Card primitive остаётся для shadcn internals. |
| Pixel-perfect main padding MM | Low | Phase 1+6: `gap-4 md:gap-6`, `px-4 py-4 md:px-6 md:py-5`; skip-link. |
| EvoBGP RHF unused | `<uncertain>` | WEB-05 vs src; не ломать формы ради RHF. |
| FW stepper unused | Low | Не удалять в этом плане без usage audit. |

**Не трогать (technical constraints):** API contracts, SSO/OIDC, permissions, TanStack vs Next routing, Go vs Fastify, package names, CRUD behaviour.

---

## 21. Final Consistency Gate

| Requirement | Status | Evidence |
|---|---|---|
| All workspace projects discovered | PASS | 6 git roots in workspace |
| All discovered UI projects audited | PASS | §§7–12 |
| All audited projects represented in final plan | PASS | coverage table + CHANGE matrix |
| Coverage = 100% | PASS | 6/6/6 |
| Current REUI PRO documentation reviewed | PASS | docs, llms.txt, MCP get_block/get_component 2026-08-17 |
| MCP/Skills reviewed | PASS | user-reui ready; skill 668fb463eb |
| Project rules reviewed | PASS | §5–6 |
| UX/UI rules evaluated | PASS | KEEP/MODIFY/REPLACE/NEW |
| Every proposed REUI component verified | PASS | registry §15 |
| Every UI CHANGE has REUI PRO Ref ID | PASS | matrix; CHANGE-023 chrome via REUI-010 |
| Every Ref ID has official documentation URL | PASS | markdown links |
| URLs point to specific REUI PRO references | PASS | preview/docs pages, not homepage |
| Every 1:1 mapping verified | PASS | only Frame/IconTile/Filters/Badge/etc. where MCP matches |
| Partial mappings marked | PASS | stats-12, shells, sheets, data-grid v8 |
| Missing REUI components marked | PASS | settings-7/empty-state-11 not target |
| No fabricated workspace data | PASS | real paths; `<not_found>` CFDM AGENTS.md; `<uncertain>` noted |
| No fabricated REUI PRO data | PASS | MCP-confirmed URLs only |
| Existing functionality preserved | PASS | each CHANGE Preserve + § constraints |
| Accessibility reviewed | PASS | IconTile a11y from official API; checklist |
| Responsive behavior reviewed | PASS | existing sidebar/sheet; Phase 6 verify |
| Target UX/UI rules defined | PASS | TARGET-001…010 + Chrome spec |
| Implementation plan complete | PASS | Phases 0–6 executed 2026-08-17 |
| Production/source code implemented | PASS | все 6 git roots; CHANGE-001…034 |

---

## Definition of Done

### Аудит (Phase 0)

- [x] Все 6 проектов обнаружены и проанализированы.
- [x] Coverage 100%.
- [x] Chrome Identity Spec зафиксирован как обязательный 1:1.
- [x] REUI registry + CHANGE matrix с прямыми URL.
- [x] Final Consistency Gate пройден.
- [x] Создан `c:\Users\shats\Dev\vps-tracker\UX-UI-PLAN.md`.

### Implementation (Phases 1–6) — 2026-08-17

- [x] CHANGE-001…034 выполнены (execution log §17).
- [x] Chrome Identity Spec во всех 6.
- [x] IconTile + hybrid KPI/QA kit.
- [x] Ops Card → Frame (VPS/EvoBGP/MM `OpsPanel`).
- [x] Empty IconStack; Sheet + AlertDialog.
- [x] a11y: skip-link, один `main`, live regions.
- [x] Acceptance checklist §19 отмечен.

**План закрыт.** Коммиты — по отдельному запросу.
