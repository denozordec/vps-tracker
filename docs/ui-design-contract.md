# UI Design Contract (ops apps)

Единый контракт для vps-tracker, CFDM и EvoBGP. Surface: **ReUI Frame**. Kit API: `apps/web/src/components/reui-kit/`.

Карта: [llms.txt](https://reui.io/llms.txt) · [Styling](https://reui.io/docs/styling) · [License](https://reui.io/docs/license-setup) · [Blocks](https://reui.io/blocks)

## Surface

```ts
// apps/web/src/lib/ui-surface.ts
export const UI_SURFACE = 'frame' as const
```

Ops / list / dashboard / detail / settings — только **Frame**, не shadcn Card как shell. Не смешивать Card и Frame на одном ops-экране.

## Canonical PRO references

| Зона | Block | Preview |
|------|-------|---------|
| Shell | `app-shell-12` (+ cmdk/monitor где нужно) | https://reui.io/preview/base/app-shell-12 · https://reui.io/preview/base/app-shell-7 |
| KPI | horizontal compact hybrid (icon left + label/Badge + value ± variant; EvoBGP visual) | https://reui.io/preview/base/stats-12 |
| Dashboard | `dashboard-1` | https://reui.io/preview/base/dashboard-1 |
| Lists | `data-grid-filtering-2` | https://reui.io/preview/base/data-grid-filtering-2 |
| Settings | `settings-16` + SettingRow | https://reui.io/preview/base/settings-16 |
| Auth | `auth-13` | https://reui.io/preview/base/auth-13 |
| Empty | `empty-state-12` | https://reui.io/preview/base/empty-state-12 |
| Forms | `form-7` → Sheet/Drawer | https://reui.io/preview/base/form-7 |

## Kit API (`reui-kit/`)

| Component | Role |
|-----------|------|
| `ResourcePage` | Frame + line tabs + Filters + DataGrid |
| `KpiStatGrid` | horizontal compact hybrid KPI tiles (`variant`, Badge) |
| `QuickActionGrid` | KPI-like quick action tiles under/after KPI (gated by `showQuickActions`) |
| `OpsDashboard` | KPI + charts + attention queue (+ optional `afterKpi`) |
| `SettingsShell` | settings nav + Outlet |
| `DetailPanel` | detail Frame sections |
| `filter-utils` | apply/clear ReUI Filters |

## Dashboard layout

| App | Section order |
|-----|---------------|
| EvoBGP / CFDM | KPI → **QuickActionGrid** → charts / rest |
| vps-tracker | banner → KPI → charts → attention → **QuickActionGrid** → CSV |

Gating: DB preference `showQuickActions` / `show_quick_actions` / `ui_show_quick_actions` (default `true`).

## Shared App Shell chrome

Эталон: **EvoBGP** production AppShell + ReUI [app-shell-12](https://reui.io/preview/base/app-shell-12).

При переключении между vps-tracker / CFDM / EvoBGP меняются **только** sidebar nav labels/hrefs и `main` content. Разметка, ширина, фон и hover chrome идентичны.

| Токен / зона | Значение |
|--------------|----------|
| `SIDEBAR_WIDTH` / `--sidebar-width` | `240px` (в `packages/ui` sidebar + Provider style) |
| Sidebar / hover colors | theme `--sidebar` / `--sidebar-accent` из `globals.css` — **без** AppShell `color-mix` override |
| Header | `h-12`, `sticky`, `border-b`, `px-4 md:px-6` |
| Header left | `SidebarTrigger` + `Separator` + Breadcrumb |
| Header right | **AppsMenu** → **SystemMonitorPopover** → **ModeToggle** (без Search в chrome) |
| Sidebar | AppSwitcher → groups (`SidebarGroupContent`) → icons `size-4` → **пустой** `SidebarFooter` |
| `main` | `gap-4 md:gap-6`, `px-4 py-4 md:px-6 md:py-5` |
| Search | hotkey ⌘K / Ctrl+K only (не кнопка в header) |

Запрещено в chrome: `SidebarRail`, `NavUser` footer, sync-row footer, Search/Ctrl+K pill в header, issues Badge в header, muted/hover cascade на right-cluster, Provider `color-mix` для `--sidebar*`.

App Switcher ids: `vps-tracker` · `cfdm` · `evobgp`. Override: `VITE_APP_SWITCHER` JSON.

QuickActionGrid icons: только semantic **text** (`text-info` / `text-primary` / …) на kit `bg-muted` — без solid `bg-primary` fills. Preview: [stats-12](https://reui.io/preview/base/stats-12).

## System monitor

`SystemMonitorPopover` in app header next to `ModeToggle` (после AppsMenu). Preview: https://reui.io/preview/base/app-shell-12 · https://reui.io/preview/base/app-shell-7

## MCP workflow

1. MCP `user-reui` — `search` / `get_block` / `get_component` with `surface: "frame"`
2. Cite `previewUrl` + `docsUrl`
3. CLI from `apps/web`: `pnpm dlx shadcn@latest add @reui/...`
4. Adapt into kit — do not hand-roll KPI/grid/settings rows
5. `validate_usage` / `get_audit_checklist`

Primitives: MCP `plugin-shadcn-shadcn` + `@cfdm/ui` / `@evobgp/ui`.

## Spacing

- AppShell main: `gap-4 md:gap-6`, `px-4 py-4 md:px-6 md:py-5` (shared chrome)
- No `space-y-*` / `space-x-*` — use `flex` + `gap-*`
- Max 1 primary CTA per screen
- Semantic tokens only (`variant="success"|"info"|"warning"`) — no raw `bg-emerald-*`

## Forbidden

- Card as ops list/dashboard shell
- Hand-rolled data tables when ReUI DataGrid exists
- Hand-rolled KPI grids when `KpiStatGrid` exists
- Mixing Card and Frame surfaces on one ops screen
