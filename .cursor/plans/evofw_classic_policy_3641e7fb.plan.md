---
name: EvoFW classic policy
overview: Классическая цепочка deny→allow→default_action (без white/blacklist). Страница агента по layout DNA solution-agents-3. Multi-set preview. EvoBGP community autocomplete/refresh.
todos:
  - id: policy-semantics
    content: Убрать white/blacklist; default_action accept|drop; единый apply deny→allow→default; deny-wins; apply_version; тесты
    status: completed
  - id: preview-api
    content: "GET /agents/:id/preview: summary, chain, CIDRs, conflicts; поле default_action"
    status: completed
  - id: agent-page-sa3
    content: Layout DNA solution-agents-3; Facts = default_action + identity (без mode toggle BL/WL)
    status: completed
  - id: agent-rules-ui
    content: Sortable sets; set detail без policy_mode; CIDR tabs Блок/Accept
    status: completed
  - id: evobgp-prefixes
    content: EvoBGP prefixes-by-community + FW refresh + docs
    status: completed
  - id: community-autocomplete
    content: FW proxy GET /v1/communities + ReUI Autocomplete
    status: completed
isProject: false
---

# Классическая политика EvoFirewall (без white/blacklist)

## Решение по white/blacklist

**White/blacklist как режимы не нужны.** Правила уже несут `deny`/`allow`; exclusive mode, который применял только один мешок CIDR, — ошибка модели.

Остаётся одна вещь, которую режимы маскировали: **что делать с пакетом, не попавшим ни в deny, ни в allow.**

| Было | Стало |
|------|--------|
| `policy_mode: blacklist` → только deny-set, default accept | `default_action: accept` |
| `policy_mode: whitelist` → только allow-set, default drop | `default_action: drop` |
| Набор со своим `policy_mode` + same-mode lock | У набора **нет** mode; только правила |
| Две разные nft/MikroTik цепочки | **Одна** цепочка всегда |

```text
1. established / lo → accept   (Linux)
2. @deny  → drop
3. @allow → accept
4. default_action → accept | drop
```

Миграция значений: `blacklist` → `accept`, `whitelist` → `drop`.

---

## Вердикт SA3 для страницы агента

**Да как layout DNA** (Header + Trace 2/3 + Facts 1/3), **нет** как AI-run шаблон.

| Элемент SA3 | Решение |
|-------------|---------|
| Header + actions | Approve / Revoke / Install / More |
| Trace Timeline | Policy chain (правила Блок/Accept) |
| Facts EditableDetailRow | **`default_action`** + identity/timestamps |
| Retry / Pause / Owners / tool calls | Не копировать |
| QuickActionGrid на detail | Убрать (действия в header) |

Preview: [solution-agents-3](https://reui.io/preview/base/solution-agents-3) · [Solutions/Agents](https://reui.io/blocks/solutions/agents)  
Страница: [`agents/$id.tsx`](c:\Users\shats\Dev\EvoFirewall\apps\web\src\routes\_auth\agents\$id.tsx)

---

## Исходное состояние (проблемы)

- Same-mode lock на assign sets ([`setAgentPolicySets`](c:\Users\shats\Dev\EvoFirewall\packages\db\src\repositories\index.ts))
- Evaluate берёт mode с первого set; whitelist **игнорирует deny** в nft; blacklist **игнорирует allow**
- MikroTik RSC **переключает** bl/wl, а не держит обе list-правила
- Preview UI нет; EvoBGP refresh path мёртвый

---

## 1. Backend

### Модель

- **Правило:** `action: deny | allow` + источник (list / cidr / hostname)
- **Агент:** `default_action: accept | drop` (колонка: migrate `agents.policy_mode` → `default_action` **или** переиспользовать колонку с новыми значениями + backfill)
- **Набор:** без mode; убрать UI/валидацию `policy_mode`; колонка `policy_sets.policy_mode` — legacy ignore / drop в след. релизе
- Убрать same-mode check; **не** писать default агента из sets

### Evaluate

[`evaluate.ts`](c:\Users\shats\Dev\EvoFirewall\apps\api\src\services\policy\evaluate.ts):

- Сбор bags по цепочке set.sort → rule.priority → overrides
- `allowCidrs = allow \ deny` (exact) → `conflicts_dropped`
- `defaultAction` с агента
- Hash: `{ apply_version: 2, defaultAction, denyCidrs, allowCidrs, generation }`

### Agent protocol / apply

Единая цепочка (nft, ipset/iptables, MikroTik install + [`mikrotik-rsc.ts`](c:\Users\shats\Dev\EvoFirewall\apps\api\src\services\policy\mikrotik-rsc.ts)):

1. established/lo accept  
2. deny → drop  
3. allow → accept  
4. default = `default_action`

JSON агенту (apply_version ≥ 2):

```json
{
  "apply_version": 2,
  "default_action": "accept",
  "deny_cidrs": [],
  "allow_cidrs": [],
  "hash": "...",
  "generation": 1
}
```

Compat на один релиз (опционально): зеркало `policy_mode: accept→blacklist, drop→whitelist` **только** для старых бинарников; новые скрипты читают `default_action` + всегда единую цепочку. После обновления one-liner — убрать зеркало.

### API / contracts

[`packages/shared/src/contracts.ts`](c:\Users\shats\Dev\EvoFirewall\packages\shared\src\contracts.ts):

- `defaultActionSchema = z.enum(['accept', 'drop'])`
- Agent PATCH/response: `default_action` (accept legacy `policy_mode` blacklist/whitelist → map)
- Policy set create/patch: **не** требовать / не экспозить mode в UI; API может игнорировать поле
- Preview:

```ts
{
  default_action, hash, generation, sync_interval_sec, apply_version: 2,
  summary: { sets, rules_deny, rules_allow, cidrs_deny, cidrs_allow, overrides, conflicts_dropped },
  chain: [{ set_id, set_name, rule_id, action, source_kind, source_label, cidr_count }],
  deny_cidrs, allow_cidrs, deny_cidrs_total, allow_cidrs_total
}
```

Только snake_case. Удалить `PolicyModeToggle` / mode с set detail.

Тесты: mixed deny+allow; exact conflict; unified apply оба default; assign разных бывших «режимов» sets без 400; hash apply_version.

---

## 2. UI: агент (SA3 layout DNA)

```bash
cd apps/web && pnpm dlx shadcn@latest add @reui/solution-agents-3 --yes
```

```
PageShell
├── AgentHeader
├── KpiStatGrid                         ← summary [stats-12]
├── grid @4xl: 2/3 + 1/3
│   ├── AgentPolicyTrace                ← chain Timeline + Collapsible + Alert
│   └── AgentFactsPanel                 ← default_action Select + identity/dates
├── AgentPolicySetsSortable             ← без фильтра mode
└── Effective CIDR Tabs                 ← Блок / Accept
```

Facts editable: «Если не совпало» → Accept / Drop (`default_action`).  
Не показывать слова blacklist/whitelist.

### Preview-референсы

| Зона | Preview | Docs |
|------|---------|------|
| Каркас | [solution-agents-3](https://reui.io/preview/base/solution-agents-3) | [agents blocks](https://reui.io/blocks/solutions/agents) |
| Frame | [frame](https://reui.io/components/frame) | [docs](https://reui.io/docs/components/base/frame) |
| Timeline | [c-timeline-6](https://reui.io/preview/base/components/c-timeline-6) | [timeline](https://reui.io/docs/components/base/timeline) |
| Facts rows | SA3 RunFacts · [settings-3](https://reui.io/preview/base/settings-3) | [settings](https://reui.io/blocks/application/settings) |
| KPI | [stats-12](https://reui.io/preview/base/stats-12) | `KpiStatGrid` |
| Sortable | [c-sortable-5](https://reui.io/preview/base/components/c-sortable-5) | [sortable](https://reui.io/components/sortable) |
| CIDR tabs | [data-grid-filtering-2](https://reui.io/preview/base/data-grid-filtering-2) · [c-tabs-2](https://reui.io/preview/base/components/c-tabs-2) | [data-grid](https://reui.io/docs/components/base/data-grid) |
| Alert | [c-alert-7](https://reui.io/preview/base/components/c-alert-7) | [alert](https://reui.io/docs/components/base/alert) |
| Empty | [empty-state-12](https://reui.io/preview/base/empty-state-12) | — |
| Sheets | [c-sheet-1](https://reui.io/preview/base/components/c-sheet-1) · [form-7](https://reui.io/preview/base/form-7) | [sheet](https://reui.io/components/sheet) |
| Autocomplete | [c-autocomplete-8](https://reui.io/preview/base/components/c-autocomplete-8) · [c-autocomplete-9](https://reui.io/preview/base/components/c-autocomplete-9) | [autocomplete](https://reui.io/docs/components/base/autocomplete) |
| Badge | [badge](https://reui.io/components/badge) | [docs](https://reui.io/docs/components/base/badge) |

Set detail: только правила deny/allow + sortable; без mode.  
Lists: community Autocomplete.

---

## 3. EvoBGP

- Autocomplete: proxy → `GET /v1/communities`
- Refresh: новый `GET /v1/communities/{id}/prefixes` в EvoBGP + fix [`refresh.ts`](c:\Users\shats\Dev\EvoFirewall\apps\api\src\services\lists\refresh.ts)
- Docs [`integrate-evobgp.md`](c:\Users\shats\Dev\EvoFirewall\docs\integrate-evobgp.md)

---

## 4. Docs

- architecture / agents: нет BL/WL; `default_action`; единый apply  
- OpenAPI: `default_action`, preview, communities proxy  

---

## Порядок работ

1. Schema/contracts: `default_action`; deprecate set/agent `policy_mode` semantics  
2. Evaluate + unified apply (nft/ipset/MikroTik) + tests + apply_version  
3. Preview API  
4. SA3 agent page + Facts `default_action`  
5. Sets sortable / set detail cleanup  
6. EvoBGP prefixes + refresh  
7. Communities autocomplete  
8. Docs + build  

## Вне скоупа

- Full first-match без sets  
- IPv6  
- AI-run UX из SA3 (Retry/Pause/Owners)  
