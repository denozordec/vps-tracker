---
name: reui
description: ReUI enterprise-компоненты в vps-tracker — registry @reui, CLI, импорты, матрица выбора. Использовать при Data Grid, Filters, Autocomplete, Number Field, Date Selector и других @reui/* задачах.
---

# ReUI (vps-tracker)

## Источники

1. [llms.txt](https://reui.io/llms.txt) — каталог для ИИ
2. MCP `plugin-shadcn-shadcn` с `registries: ["@reui"]`
3. Docs: `https://reui.io/docs/components/base/<name>` (Copy Markdown)
4. Правила: `.cursor/rules/reui-mcp.mdc`

## CLI (только из apps/web)

```bash
cd apps/web
pnpm dlx shadcn@latest add @reui/data-grid --dry-run
pnpm dlx shadcn@latest add @reui/filters
```

## Размещение

| Registry | Путь | Импорт |
|----------|------|--------|
| `@shadcn` | `packages/ui/src/components/` | `@cfdm/ui/components/*` |
| `@reui` | `apps/web/src/components/reui/` | `@/components/reui/*` |

Только **Base UI** (`base-nova`). Radix-варианты не использовать.

## Уже установлено

`autocomplete`, `badge`, `color-picker`, `data-grid/*`, `date-selector`, `filters`, `number-field`

## Shared-обёртки проекта

| ReUI | Обёртка |
|------|---------|
| data-grid | `DataGridCard` |
| filters | `VpsFiltersToolbar` |
| autocomplete | `AutoCompleteInput` |
| date-selector | `lib/date-selector-i18n.ts` |

## Матрица выбора

- Простая таблица → shadcn `Table`
- Списки с sort/pagination/virtual/columns → `DataGridCard` (`@reui/data-grid`)
- Мультифильтры → `@reui/filters`
- Числа со stepper → `@reui/number-field`
- Semantic status → `StatusBadge` или `@reui/badge` variant

## Зависимости (apps/web only)

`@tanstack/react-table`, `@tanstack/react-virtual`, `@dnd-kit/*`, `date-fns`, `react-day-picker`

После add — `pnpm install` + `pnpm --filter web build`.

## Post-add

- `@/components/ui/*` → `@cfdm/ui/components/*`
- Не класть ReUI в `packages/ui`
- Semantic colors: `variant="success"` — не `bg-emerald-*`
