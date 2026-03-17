# VPS Tracker — Руководство для ИИ

## Описание проекта

VPS Tracker — приложение для учёта виртуальных серверов (VPS), провайдеров, аккаунтов, платежей и балансов. Поддерживает синхронизацию с BILLmanager 6 API.

## Структура проекта

```
vps-tracker/
├── server/                 # Express backend
│   ├── index.js            # Точка входа, подключение роутов
│   ├── db/                 # База данных (SQLite via sql.js)
│   │   ├── schema.js       # CREATE TABLE
│   │   ├── migrations.js   # Миграции схемы
│   │   ├── seed.js         # Начальные данные из public/data
│   │   └── index.js        # initDb, getDb, saveDb
│   ├── adapters/           # Интеграции с внешними API
│   │   └── billmanager/    # BILLmanager 6 API
│   │       ├── client.js   # HTTP-запросы
│   │       ├── parsers.js  # Парсинг ответов API
│   │       ├── mappers.js  # Маппинг в модель vps-tracker
│   │       ├── operations.js # fetchVds, fetchPayments и т.д.
│   │       ├── sync.js     # syncFromBillmanager
│   │       └── index.js    # Barrel export
│   ├── routes/             # Express роутеры
│   ├── utils/              # row-mappers и др.
│   └── sync-scheduler.js   # Планировщик синка
├── src/                    # React frontend (Vite)
│   ├── pages/              # Страницы приложения
│   ├── components/         # UI-компоненты
│   └── lib/                # api.js, utils.js
└── public/data/            # JSON для seed (providers, vps, payments...)
```

## Основные сущности

| Сущность | Описание |
|----------|----------|
| **providers** | Хостинг-провайдеры (Selectel, Firstbyte и т.д.) |
| **provider_accounts** | Аккаунты у провайдера, могут иметь apiType=billmanager для синка |
| **vps** | Виртуальные серверы (ip, ram, disk, tariffType, paidUntil) |
| **payments** | Платежи (пополнение баланса, оплата VPS) |
| **balance_ledger** | Движения по балансу |
| **active_tariffs** | Тарифы, загруженные из BILLmanager vds.order |
| **settings** | Настройки приложения (baseCurrency, ratesUrl, syncEnabled) |

## Где искать код по доменам

- **Sync (BILLmanager)** — `server/adapters/billmanager/`, `server/routes/sync.js`, `server/sync-scheduler.js`
- **Тарифы** — `server/adapters/billmanager/operations.js` (fetchVdsOrderPricelist), `server/adapters/billmanager/sync.js`
- **VPS CRUD** — `server/routes/vps.js`
- **Платежи/баланс** — `server/routes/payments.js`, `server/routes/balance-ledger.js`
- **Курсы валют** — `src/lib/utils.js` (convertCurrency, formatInBaseCurrency), настройки в settings.ratesUrl

## BILLmanager API

- [Guide to ISPsystem API](https://www.ispsystem.com/docs/b6c/developer-section/working-with-api/guide-to-ispsystem-software-api)
- [VDS API](https://www.ispsystem.com/docs/b6c/developer-section/billmanager-api/virtual-private-servers-vds)
- [Payments API](https://www.ispsystem.com/docs/b6c/developer-section/billmanager-api/payments-payment)

Формат запроса: `?authinfo=user:pass&out=bjson&func=vds|payment|dashboard.info|vds.order`
