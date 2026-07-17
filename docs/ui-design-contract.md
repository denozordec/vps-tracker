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
| Shell | `app-shell-12` (+ cmdk/monitor где нужно) | https://reui.io/preview/base/app-shell-12 |
| KPI | hybrid `stats-12` (compact Frame strip: colored icon → value ± variant → label → Badge footer) | https://reui.io/preview/base/stats-12 |
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
| `KpiStatGrid` | hybrid compact stats-12 KPI tiles (`variant`, Badge footer) |
| `OpsDashboard` | KPI + charts + attention queue |
| `SettingsShell` | settings nav + Outlet |
| `DetailPanel` | detail Frame sections |
| `filter-utils` | apply/clear ReUI Filters |

## MCP workflow

1. MCP `user-reui` — `search` / `get_block` / `get_component` with `surface: "frame"`
2. Cite `previewUrl` + `docsUrl`
3. CLI from `apps/web`: `pnpm dlx shadcn@latest add @reui/...`
4. Adapt into kit — do not hand-roll KPI/grid/settings rows
5. `validate_usage` / `get_audit_checklist`

Primitives: MCP `plugin-shadcn-shadcn` + `@cfdm/ui` / `@evobgp/ui`.

## Spacing

- Main: `gap-4 md:gap-6`, `px-4 md:px-6`
- No `space-y-*` / `space-x-*` — use `flex` + `gap-*`
- Max 1 primary CTA per screen
- Semantic tokens only (`variant="success"|"info"|"warning"`) — no raw `bg-emerald-*`

## Forbidden

- Card as ops list/dashboard shell
- Hand-rolled data tables when ReUI DataGrid exists
- Hand-rolled KPI grids when `KpiStatGrid` exists
- Mixing Card and Frame surfaces on one ops screen
