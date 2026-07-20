# UI Design Contract (ops apps)

Единый контракт для **CFDM · vps-tracker · EvoBGP · EvoFirewall · auth-portal**.  
Surface: **ReUI Frame**. Kit: `apps/web/src/components/reui-kit/`.  
Иерархия: **ReUI PRO > shadcn primitives**.

Карта: [llms.txt](https://reui.io/llms.txt) · [Styling](https://reui.io/docs/styling) · [License](https://reui.io/docs/license-setup) · [Blocks](https://reui.io/blocks) · [MCP](https://reui.io/docs/mcp)

## Surface

Project lock: **`surface: frame`**. Ops / list / dashboard / detail / settings — только **Frame**, не shadcn Card как shell. Не смешивать Card и Frame на одном ops-экране.

```ts
// apps/web/src/lib/ui-surface.ts (где есть)
export const UI_SURFACE = 'frame' as const
```

Settings: секции через Frame + `gap` (без hairline `Separator` под PageHeader); `SettingRow` без `FieldSeparator` по умолчанию (`separated` opt-in). Preview: [settings-3](https://reui.io/preview/base/settings-3) · [settings-16](https://reui.io/preview/base/settings-16).

## Canonical PRO references

| Зона | Block | Preview |
|------|-------|---------|
| Shell | `app-shell-12` (+ cmdk/monitor где нужно) | https://reui.io/preview/base/app-shell-12 · https://reui.io/preview/base/app-shell-7 |
| KPI | horizontal compact hybrid (EvoBGP SoT: icon left + label/Badge + value ± variant) | https://reui.io/preview/base/stats-12 |
| Quick Actions | Frame tiles (sibling KPI) + Badge «Перейти» | https://reui.io/preview/base/stats-12 · https://reui.io/preview/base/card-12 |
| Dashboard | `dashboard-1` | https://reui.io/preview/base/dashboard-1 |
| Lists | `data-grid-filtering-2` | https://reui.io/preview/base/data-grid-filtering-2 |
| Settings | `settings-16` + SettingRow | https://reui.io/preview/base/settings-16 |
| Auth | `auth-13` | https://reui.io/preview/base/auth-13 |
| Empty | `empty-state-12` | https://reui.io/preview/base/empty-state-12 |
| Forms | `form-7` → Sheet/Drawer | https://reui.io/preview/base/form-7 |

## Kit API (`reui-kit/`)

| Component | Role |
|-----------|------|
| `ResourcePage` | Frame + line tabs + Filters + DataGrid (primary lists; without Filters → simple CRUD grid) |
| `FrameDataGrid` | Internal / embedded Frame grid used by ResourcePage simple mode |
| `KpiStatGrid` | EvoBGP hybrid KPI tiles (`items`/`cards`, `variant`, Badge) |
| `QuickActionGrid` | KPI-like quick action tiles (gated by `showQuickActions`) |
| `OpsDashboard` | KPI + optional `afterKpi` + charts + attention queue |
| `SettingsShell` | settings nav + Outlet |
| `DetailPanel` | detail Frame sections |
| `filter-utils` | apply/clear ReUI Filters |

`KpiStatGrid` / `QuickActionGrid` markup — SoT **EvoBGP**; в остальных apps diff только `@scope/ui` imports.

## Dashboard layout

| App | Section order |
|-----|---------------|
| EvoBGP / CFDM / EvoFirewall | KPI → **QuickActionGrid** → charts / rest |
| vps-tracker | banner → KPI → charts → attention → **QuickActionGrid** → CSV |
| auth-portal | portal-specific; Quick Actions при наличии dashboard |

Gating: DB `show_quick_actions` / `showQuickActions` / `ui_show_quick_actions` (default `true`).

## Shared App Shell chrome

Эталон разметки: production apps + ReUI [app-shell-12](https://reui.io/preview/base/app-shell-12).  
При переключении между apps меняются **только** sidebar nav labels/hrefs и `main` content.

| Токен / зона | Значение |
|--------------|----------|
| `SIDEBAR_WIDTH` / `--sidebar-width` | `240px` |
| Sidebar / hover colors | theme `--sidebar` / `--sidebar-accent` — **без** AppShell `color-mix` override |
| Header | `h-12`, `sticky`, `border-b`, `px-4 md:px-6` |
| Header left | `SidebarTrigger` + `Separator` + Breadcrumb |
| Header right | **AppsMenu** → **SystemMonitorPopover** (тема — в NavUser) |
| Sidebar | AppSwitcher → groups → icons `size-4` → **NavUser** в `SidebarFooter` |
| `main` | `gap-4 md:gap-6`, `px-4 py-4 md:px-6 md:py-5` |
| Search | hotkey ⌘K / Ctrl+K only (не кнопка в header) |

Запрещено в chrome: `SidebarRail`, sync-row footer, Search pill в header, issues Badge в header, `ModeToggle` в header (тема только в NavUser), Provider `color-mix` для `--sidebar*`.

NavUser (footer): avatar + name/email; dropdown — Настройки / Тема (segmented) / Выйти. Preview: [app-shell-1](https://reui.io/preview/base/app-shell-1).

App Switcher: auth-portal `GET /api/v1/app-switcher`. Ids: `cfdm` · `vps` · `bgp` · `fw`. Admin: portal `/admin/apps`.

QuickActionGrid / KPI icons: только semantic **text** (`text-info` / `text-primary` / …) на kit `bg-muted` — без solid fills.

## System monitor

`SystemMonitorPopover` in header after AppsMenu. Preview: https://reui.io/preview/base/app-shell-12 · https://reui.io/preview/base/app-shell-7

## MCP workflow

1. MCP `user-reui` — `search` / `get_block` / `compose_page` / `get_component` with `surface: "frame"`
2. Cite `previewUrl` + `docsUrl`
3. CLI from `apps/web`: `pnpm dlx shadcn@latest add @reui/...`
4. Adapt into kit — do not hand-roll KPI / Quick Actions / grid / settings rows
5. `validate_usage` / `get_audit_checklist`

Primitives: MCP `plugin-shadcn-shadcn` + project `@scope/ui` (`@cfdm/ui` / `@evobgp/ui` / `@evofw/ui` / `@authportal/ui`).

## License

```env
# apps/web/.env.local (gitignored)
REUI_LICENSE_KEY=
```

`apps/web/components.json` → `@reui` с `Authorization: Bearer ${REUI_LICENSE_KEY}`.

## Spacing

- AppShell main / PageShell: `gap-4 md:gap-6`, `px-4 py-4 md:px-6 md:py-5`
- No `space-y-*` / `space-x-*` — use `flex` + `gap-*`
- Max 1 primary CTA per screen
- Semantic tokens only — no raw `bg-emerald-*`

## Forbidden

- Card as ops list/dashboard shell
- Hand-rolled data tables when ReUI DataGrid / `ResourcePage` exists
- Hand-rolled KPI when `KpiStatGrid` exists
- Hand-rolled Quick Actions when `QuickActionGrid` exists
- SectionCards / DataGridCard as design эталон
- Mixing Card and Frame surfaces on one ops screen
