# План миграции UI vps-tracker на дизайн «VPS-Tracker»

Источник: артефакт-канвас [VPS-Tracker](https://claude.ai/artifact/7kPVbQNXa4AWgFkSekZJiN#page-dcb81aee8d83), доски `Vps*.dc.html` + шаблон `TplVps.dc.html` + токены `reui-auth.css`.
Канвас — макет, имитирующий ReUI; его CSS **не переносим**. Используем как спецификацию регионов и токенов, а реализуем на ReUI PRO + shadcn primitives (контракт: [`ui-design-contract.md`](ui-design-contract.md)).

Лицензия ReUI PRO: `REUI_LICENSE_KEY` есть, премиум-реестр отвечает 200 (проверено на `app-shell-12`).

## Что не является страницами

- Блоки `states` («Справочник состояний · не часть страницы») — только спецификация empty/loading/error, на страницах не рендерим.
- Доски `VpsCollapsed`, `VpsLight`, `VpsMobile`, `VpsPalette` — состояния одного экрана; используем для проверки (свёрнутый сайдбар, светлая тема, ширина телефона, ⌘K).
- Инструменты канваса: полосы `wedit`, «звёздочки»/закрепы в меню, атрибуты density/contrast — пропускаем.

## Сохраняем то, чего нет в макете

`SpaceSwitcher` (пространства — реальная функция), `GlobalSearch` (⌘K), фильтры ReUI `Filters` в списках, CSV-экспорт, row actions. Макет их не отменяет.

## Сопоставление блоков макета → ReUI

| Блок макета | Реализация | ReUI / shadcn |
|---|---|---|
| sidebar `asbtn` (лого + «Учёт серверов и платежей») + поповер приложений | `AppSwitcher` (+ пункты бывшего `AppsMenu`) | shadcn `sidebar`, `dropdown-menu`; эталон [app-shell-12](https://reui.io/preview/base/app-shell-12) `brand.tsx` |
| `grph` — сворачиваемые группы (UPPERCASE + шеврон) | `NavGroup` в `app-shell.tsx` | shadcn `sidebar` + `collapsible` (паттерн Collapsible SidebarGroup) |
| `pdot` — точка проблем у пункта меню | `SidebarMenuBadge` / точка `bg-destructive` | shadcn `sidebar` |
| `user` — NavUser карточкой | `NavUser` | [app-shell-1](https://reui.io/preview/base/app-shell-1) user menu |
| header: trigger + crumbs + `statb` | `AppShell` header, без `AppsMenu` | shadcn `breadcrumb`, `popover` |
| `statb` «Внимание · ●1 ●2» → монитор | триггер `SystemMonitorPopover` | `@reui/badge` (`warning-light`/`destructive-light`) |
| h1 + sub + actions | `PageHeader` | — |
| `banner` / `note` | `Alert` | `@reui/alert` |
| `kpi` (иконка слева, label, value, chip) | `KpiStatGrid` | `@reui/icon-tile`, `@reui/badge`, Frame ([stats-12](https://reui.io/preview/base/stats-12)) |
| `ptabs` — вкладки страницы со счётчиками | `CountedLineTabs` | shadcn `tabs` variant `line` (c-tabs-2) |
| `seg` — сегменты вида/снимка | `ToggleGroup` | shadcn `toggle-group` |
| `grid` — Frame: заголовок, поиск, колонки, виды, bulk, футер | `ResourcePage` / `FrameDataGrid` | `@reui/data-grid`, `@reui/filters`, `@reui/frame` ([data-grid-filtering-2](https://reui.io/preview/base/data-grid-filtering-2)) |
| `cards` (быстрые действия) | `QuickActionGrid` | Frame tiles |
| `chart` | Recharts через shadcn `chart` | — |
| `kv` | `DetailPanel` | `@reui/frame` |
| `timeline` | `Timeline` | `@reui/timeline` |
| `form` (`frow`) | `SettingRow` | [settings-16](https://reui.io/preview/base/settings-16) |

## Тема и шрифты

- Палитра макета: нейтрали с оттенком **hue 264** (`--background: oklch(0.133 0.011 264.376)` и т.д.), `info` — фиолетовый, `chart-1..4` из макета; в светлой теме **сайдбар остаётся тёмным**.
- Где живёт: `packages/ui/src/styles/globals.css` — только вывод `shadcn` CLI, руками не трогаем. Оверрайд — слой приложения **`apps/web/src/styles/theme.css`** (импорт после `@cfdm/ui/globals.css` в `main.tsx`): переопределяет переменные `:root`/`.dark` и `--sidebar*` для светлой темы. Компоненты ReUI не рестайлим — меняются только токены.
- Шрифты: **Geist** / **Geist Mono** через `@fontsource-variable/geist` и `@fontsource-variable/geist-mono`; `--font-sans` / `--font-mono` в `theme.css`.

## Изменения по экранам (`apps/web/src/routes/_auth/*`)

| Маршрут | Доска | Изменения | Статус |
|---|---|---|---|
| `dashboard` | VpsDashboard | баннер → KPI (6) → **вкладки** «Проблемы» (быстрые действия, графики Платежи/Расходы, «Здоровье инвентаря») · «Последние VPS» · «Аккаунты» (под риском) | сделано |
| `vps` | VpsList | заголовок «VPS / Виртуальные серверы», Alert несвязанных доменов, Frame-грид «Инвентарь VPS» с подзаголовком | сделано (заголовок грида); Alert доменов и фильтры — уже были |
| `vps.$vpsId` | VpsDetail | крошки VPS / IP, действия «К списку VPS» + «Редактировать», **вкладки** Обзор / Финансы / Заметки / Синк | сделано (line-вкладки, действия, крошки «VPS / IP»); маршрут вынесен в `vps_.$vpsId` |
| `accounts` | VpsAccounts | KPI (4) + грид, действия «Синхронизировать все» + «Добавить» | уже соответствует («Синхронизировать все» — при наличии API-аккаунтов) |
| `providers` | VpsProviders | грид «Хостеры» | уже соответствует |
| `projects`, `projects.$projectId` | VpsProjects / VpsProjectDetail | KPI (4) + грид | уже соответствует; крошки «Проекты / имя»; маршрут вынесен в `projects_.$projectId` |
| `tariffs` | VpsTariffs | Alert расхождений + грид | уже соответствует («Загрузить тарифы» — при наличии API) |
| `payments` | VpsPayments | KPI (3) + грид | уже соответствует |
| `balance` | VpsBalance | KPI (3) + грид, футер с итогами | уже соответствует |
| `reports`, `resources` | VpsReports / VpsResources | сегмент периода, KPI, графики в Frame | уже соответствует |
| `renewals` | VpsRenewals | KPI (3) + грид | уже соответствует |
| `blocking`, `geo` | VpsBlocking / VpsGeo | KPI (4) + сегменты + вкладки Текущие / История | уже соответствует |
| `topology` | VpsTopology | без изменений структуры (холст) | без изменений |
| `spaces` | VpsSpaces | секции Frame | уже соответствует |
| `sync-journal` | VpsSync | грид «Запуски синхронизации» | уже соответствует |
| `audit` | VpsAudit | вкладки по действию + переключатель Лента / Таблица | сделано (общие CountedLineTabs) |
| `settings/*` | VpsSettings | **вкладки сверху** Общие / Синхронизация / Уведомления / Интеграции вместо боковой навигации `SettingsShell` | сделано |

## Общие компоненты

- `layout/app-shell.tsx` — сворачиваемые группы, точки проблем, header без `AppsMenu`.
- `app-switcher.tsx` — подзаголовок, приложения из `AppsMenu`; `layout/apps-menu.tsx` удаляется из header.
- `layout/nav-user.tsx` — карточка (muted фон), меню Настройки / Тема / Выйти (без изменений логики).
- `layout/system-monitor-popover.tsx` — триггер-пилюля «Внимание» со счётчиками ошибок/предупреждений, футер «Журнал синка».
- `reui-kit/settings-shell.tsx` — line-tabs сверху.
- `counted-line-tabs.tsx` — счётчик моноширинным текстом как в макете.

## Порядок

1. План + контракт (этот документ, [`ui-design-contract.md`](ui-design-contract.md)).
2. Тема и шрифты (`theme.css`, fontsource).
3. Shell: AppSwitcher, группы, NavUser, header, монитор.
4. Kit: `CountedLineTabs`, `SettingsShell`.
5. Экраны: dashboard → VPS detail → settings → audit → blocking/geo → прочие (тексты, колонки).
6. Проверка: dev-сервер, 1440×1000 + свёрнутый сайдбар + светлая тема + телефон; `pnpm --filter web build`, `pnpm --filter web test`; `validate_usage`, `get_audit_checklist`.

## Установка

Новые ReUI-элементы не требуются: всё нужное уже установлено (`frame`, `badge`, `alert`, `data-grid`, `filters`, `timeline`, `icon-tile`) и shadcn (`sidebar`, `collapsible`, `tabs`, `toggle-group`). Добавляются только пакеты шрифтов. Если при реализации понадобится новый элемент — `cd apps/web && pnpm dlx shadcn@latest add @reui/<name>`.

## Итог проверки

- Сверка: артефакт в браузере не рендерится без входа в claude.ai, поэтому соответствие проверено по структуре досок `.dc.html` (заголовки, подзаголовки, действия, KPI, вкладки, блоки) и скриншотам dev-сервера 1440×1000, свёрнутого меню, светлой темы и ширины телефона.
- «Уже соответствует» — экран сверен по тексту (`h1`, подзаголовок, действия) с доской; визуальные отличия закрыты общими изменениями темы, shell, KPI и шапки страницы.
