# VPS Tracker — Руководство для ИИ

## Описание проекта

VPS Tracker — приложение для учёта виртуальных серверов (VPS), провайдеров, аккаунтов, платежей и балансов. Поддерживает синхронизацию с BILLmanager 6 API.

## Стек

- **Monorepo:** pnpm workspaces (`apps/*`, `packages/*`)
- **Frontend** (`apps/web`): Vite + React 19 + TypeScript, TanStack Router v1 + Query v5, shadcn/ui (`@cfdm/ui`), **ReUI** (`@reui` → `@/components/reui`), Tailwind v4, lucide-react, Recharts (через shadcn Chart), react-hook-form + Zod
- **Backend** (`apps/api`): Fastify 5 + TypeScript, `@fastify/*` plugins, контракты через `@cfdm/shared` (Zod)
- **DB** (`packages/db`): Drizzle ORM + better-sqlite3 (WAL, `foreign_keys=ON`)
- **Тесты:** Vitest (`app.inject()` для backend, `happy-dom` для frontend)

## Структура проекта

```
vps-tracker/
├── apps/
│   ├── web/              # Vite SPA (TSX) — TanStack + shadcn/ui + ReUI
│   │   └── src/
│   │       ├── routes/           # file-based (TanStack Router)
│   │       ├── queries/          # queryOptions + key factories
│   │       ├── components/       # shared + layout + domain
│   │       │   └── reui/         # ReUI CLI output (@reui/*)
│   │       └── lib/              # api-client, queryClient, router, schemas
│   └── api/              # Fastify 5 API (TS)
│       └── src/
│           ├── routes/           # тонкие plugins
│           ├── services/         # бизнес-логика + billmanager/
│           │   └── billmanager/  # client, parsers, mappers, operations, sync
│           └── plugins/          # @fastify/* registration
├── packages/
│   ├── ui/               # @cfdm/ui — shadcn primitives
│   │   └── src/
│   │       ├── components/       # output `shadcn add` (не трогать под кейс)
│   │       ├── hooks/            # use-mobile и др.
│   │       ├── lib/utils.ts      # cn()
│   │       └── styles/globals.css # только output `shadcn apply --only theme`
│   ├── shared/           # @cfdm/shared — Zod-контракты, общие типы
│   └── db/               # @cfdm/db — Drizzle schema, repositories, миграции
│       └── src/
│           ├── schema/           # tables по сущностям
│           ├── repositories/     # typed queries
│           └── migrations/       # drizzle-kit
├── data/                 # SQLite база (том Docker, gitignored)
├── pnpm-workspace.yaml
└── package.json
```

## Основные сущности

| Сущность | Описание |
|----------|----------|
| **providers** | Хостинг-провайдеры; для BILLmanager: **apiType**, **apiBaseUrl** (один URL на хостера) |
| **provider_accounts** | Аккаунты у провайдера; **apiCredentials** (логин:пароль API) для синка с BILLmanager |
| **vps** | Виртуальные серверы (ip, ram, disk, tariffType, paidUntil) |
| **payments** | Платежи (пополнение баланса, оплата VPS) |
| **balance_ledger** | Движения по балансу |
| **active_tariffs** | Тарифы, загруженные из BILLmanager vds.order |
| **settings** | Настройки приложения (baseCurrency, ratesUrl, syncEnabled) |

## Где искать код по доменам

- **Sync (BILLmanager)** — `apps/api/src/services/billmanager/`, `apps/api/src/routes/sync.ts`, scheduler в `apps/api/src/services/`
- **Тарифы** — `apps/api/src/services/billmanager/operations.ts` (fetchVdsOrderPricelist), `apps/api/src/services/billmanager/sync.ts`
- **VPS CRUD** — `apps/api/src/routes/vps.ts`, `packages/db/src/repositories/vps.ts`
- **Платежи/баланс** — `apps/api/src/routes/payments.ts`, `apps/api/src/routes/balance-ledger.ts`
- **Курсы валют** — `apps/web/src/lib/format.ts` (convertCurrency, formatInBaseCurrency), настройки в `settings.ratesUrl`
- **UI shared** — `apps/web/src/components/` (PageShell, PageHeader, EmptyState, QueryState, ConfirmDialog, **DataGridCard**, VpsFiltersToolbar, AutoCompleteInput, SectionCards, StatusBadge, FormSheet, FormField, LoadingButton)
- **UI primitives** — `packages/ui/src/components/*` (только output `shadcn add`)
- **ReUI enterprise** — `apps/web/src/components/reui/*` (output `shadcn add @reui/*`); см. [`reui-mcp.mdc`](.cursor/rules/reui-mcp.mdc)

## BILLmanager API

- [Guide to ISPsystem API](https://www.ispsystem.com/docs/b6c/developer-section/working-with-api/guide-to-ispsystem-software-api)
- [VDS API](https://www.ispsystem.com/docs/b6c/developer-section/billmanager-api/virtual-private-servers-vds)
- [Payments API](https://www.ispsystem.com/docs/b6c/developer-section/billmanager-api/payments-payment)

Формат запроса: `?authinfo=user:pass&out=bjson&func=vds|payment|dashboard.info|vds.order`

## Уведомления

- **Движок:** `apps/api/src/services/notifications/` — rules, dedup, engine, channels
- **Планировщик:** `apps/api/src/services/scheduler.ts` — sync отдельно; notify/uptime не зависят от `syncEnabled`
- **События:** `payment_expiry`, `sync_digest`, `low_balance`, `new_tariffs`, `vps_down`, `vps_up`
- **Каналы:** Telegram (`telegram.ts`) и webhook (`webhook.ts`); webhook работает без Telegram
- **Журнал:** таблица `notification_log`, API `GET /api/notifications/log`
- **Дедупликация:** `notification_state` — daily / fingerprint / state_transition

## Команды

```bash
pnpm install
pnpm --filter web dev          # frontend dev
pnpm --filter api dev          # backend dev
pnpm --filter web build        # production build frontend
pnpm --filter api test         # Vitest backend
pnpm --filter web test         # Vitest frontend
```

## ReUI

- Registry: `@reui` в [`apps/web/components.json`](apps/web/components.json)
- AI-карта: [llms.txt](https://reui.io/llms.txt)
- Установка: `cd apps/web && pnpm dlx shadcn@latest add @reui/<name>`
- Правила: [`reui-mcp.mdc`](.cursor/rules/reui-mcp.mdc), [`shadcn-mcp.mdc`](.cursor/rules/shadcn-mcp.mdc)
- Зависимости ReUI в `apps/web`: `@tanstack/react-table`, `@tanstack/react-virtual`, `@dnd-kit/*`, `date-fns`, `react-day-picker`

## Соглашения

- UI — [shadcn/ui](https://ui.shadcn.com) + [ReUI](https://reui.io/docs/get-started) через MCP `plugin-shadcn-shadcn`
- Коммиты — на русском, см. [`commit-messages-ru.mdc`](.cursor/rules/commit-messages-ru.mdc)
- Gitflow — см. [`gitflow.mdc`](.cursor/rules/gitflow.mdc)
- Структура — см. [`project-structure.mdc`](.cursor/rules/project-structure.mdc)
