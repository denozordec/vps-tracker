# BILLmanager hoster profiles

Унифицированные переопределители для исключений из стандартного ISPsystem API.

## Как добавить профиль (5 минут)

1. Создай `profiles/<id>.ts` с **только расхождениями**:

```ts
import type { BillmanagerProfileOverrides } from './types.js'

export const myHosterOverrides: BillmanagerProfileOverrides = {
  id: 'myhoster',
  match: {
    hostnames: ['myhoster.com'],
    keywords: ['myhoster'],
  },
  funcs: {
    listVds: 'vds.custom', // если отличается от 'vds'
  },
  // map: { enrichVds: (item, mapped) => ({ ...mapped, country: 'DE' }) },
  // requestParams: { listVds: { p_cnt: 1000 } },
}
```

2. Зарегистрируй в [`registry.ts`](./registry.ts) — массив `PROFILE_OVERRIDES` (порядок = приоритет матча).

3. Добавь fixture + тест в [`profiles.test.ts`](../profiles.test.ts).

4. Новый hook (редко) — расширь `BillmanagerProfile` в [`types.ts`](./types.ts) и значение в [`default.ts`](./default.ts).

## Контракт

| Поле | Назначение |
|------|------------|
| `match.hostnames` | substring hostname |
| `match.keywords` | substring всего URL |
| `funcs.*` | `func=` для list / payment / dashboard / order |
| `extract.*` | ключ для `extractList` |
| `map.vds` / `map.payment` | полный маппер |
| `map.enrichVds` | пост-обработка после default map |
| `requestParams.*` | доп. query params |

`resolveBillmanagerProfile(apiBaseUrl)` → `merge(DEFAULT, override)` или `DEFAULT`.

Sync и operations **не** содержат `if (hoster)` — только профиль.

## Готовые профили

| id | Match | Что переопределяет |
|----|-------|-------------------|
| `waicore` | `waicore.com` / keyword | `funcs.listVds = vds.vps`; geo из `datacentername` (`[DE] Город \| …` / `Страна, Город`) |
| `firstbyte` | `firstbyte.ru`, `firstbyte.club`, `1byte.ru` | `enrichVds`: страна/город, daily из `billdaily`/`Ежедневное списание`, `dailyRate=cost/30`; `enrichVdsBatch`: общий баланс ÷ сумма daily → один `paidUntil`; specs из `vds.order` / `vds.edit` |
| `ihor` | `my-ihor.ru`, `ihor.ru` / keyword | `enrichVds`: geo из `datacentername` (`Москва DC3` → Россия / Москва) |
| `cloudrix` | `cloudrix.ru` / keyword | `enrichVds`: geo (`Россия, Москва`) + `ipv6_subnet`; specs через `vds.order` / `vds.edit` (`fetchVdsEditForSpecs`) |
| `servhost` | `serv.host` | `enrichVds`: geo (`Новосибирск Xeon` → Россия / Новосибирск); specs через `vds.order` / `vds.edit` |
| `landvps` | `landvps.online` / keyword | `enrichVds`: geo (`ДЦ Москва` → Россия / Москва) + `ipv6_subnet`; specs через `vds.order` / `vds.edit` |
| `datacheap` | `datacheap.ru` / keyword | `enrichVds`: geo (`Россия`); specs через `vds.order` / `vds.edit` |
