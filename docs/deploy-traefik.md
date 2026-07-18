# Развёртывание VPS Tracker + Traefik (Linux, HTTPS, Cloudflare DNS-01)

Один стек Docker Compose: **Traefik** (HTTPS, Let's Encrypt через Cloudflare DNS challenge) + **vps-tracker** (API + SPA, SQLite).

| | |
|---|---|
| Образ | `ghcr.io/denozordec/vps-tracker` (или свой registry через `VPS_TRACKER_IMAGE`) |
| Пример URL | `https://vps.example.com` |
| Compose | [`deploy/docker-compose.traefik.yml`](../deploy/docker-compose.traefik.yml) |
| Env | [`deploy/env.traefik.example`](../deploy/env.traefik.example) |

Документация Traefik: [Expose Docker](https://doc.traefik.io/traefik/expose/docker/basic/), [ACME DNS challenge](https://doc.traefik.io/traefik/https/acme/), [Cloudflare provider](https://doc.traefik.io/traefik/https/acme/#providers).

```
Internet → :80/:443 (Traefik) → vps-tracker:3001
                ↑
         Cloudflare DNS TXT (_acme-challenge) для Let's Encrypt
```

## Предпосылки

1. Зона домена в **Cloudflare**.
2. **Linux** VPS с **Docker Engine** + плагин **Compose**.
3. Свободные порты **80** и **443** на хосте (этот стек сам поднимает Traefik).
4. Доступ к registry образа (`docker login ghcr.io` или `git.shts.su`).

> Если на сервере уже крутится другой Traefik/nginx на 80/443 — остановите его или смените `TRAEFIK_HTTP_PORT` / `TRAEFIK_HTTPS_PORT`. Два процесса на одних портах не запустятся.

---

## 1. Cloudflare: токен и DNS

### API-токен для ACME

[API Tokens → Create Token](https://dash.cloudflare.com/profile/api-tokens) — шаблон **Edit zone DNS** или Custom:

| Permission | Access |
|------------|--------|
| Zone → DNS | **Edit** |
| Zone → Zone | Read (желательно) |

**Zone Resources:** Include → Specific zone → ваша зона.

Значение токена → `CF_DNS_API_TOKEN` в `.env`. Не Global API Key, не коммитьте в Git.

### DNS-запись хоста

| Type | Name | Content | Proxy |
|------|------|---------|-------|
| `A` / `AAAA` | `vps` (или нужный поддомен) | IP вашего VPS | **DNS only** (серое облако) |

```bash
dig +short vps.example.com A
```

Traefik для сертификата создаёт TXT `_acme-challenge.…` через Cloudflare API. HTTP-01 на публичный :80 для выдачи сертификата **не обязателен** (удобно при firewall / CDN).

---

## 2. Файлы на сервере

```bash
mkdir -p /opt/vps-tracker/data
cd /opt/vps-tracker

# Вариант A — из клона репозитория:
#   cp deploy/docker-compose.traefik.yml docker-compose.yml
#   cp deploy/env.traefik.example .env

# Вариант B — скачать с GitHub:
curl -fsSL -o docker-compose.yml \
  https://raw.githubusercontent.com/denozordec/vps-tracker/main/deploy/docker-compose.traefik.yml
curl -fsSL -o .env \
  https://raw.githubusercontent.com/denozordec/vps-tracker/main/deploy/env.traefik.example

nano .env   # заполнить секреты и домен
```

### Обязательные переменные в `.env`

| Переменная | Назначение |
|------------|------------|
| `CF_DNS_API_TOKEN` | Cloudflare token для ACME DNS-01 (env контейнера **Traefik**) |
| `LETSENCRYPT_EMAIL` | Email для Let's Encrypt |
| `VPS_DOMAIN` | Хост в Traefik `Host(…)` (например `vps.example.com`) |

Опционально:

| Переменная | Назначение |
|------------|------------|
| `VPS_TRACKER_IMAGE` / `VPS_TRACKER_IMAGE_TAG` | Образ и тег |
| `TRAEFIK_IMAGE_TAG`, `TRAEFIK_HTTP_PORT`, `TRAEFIK_HTTPS_PORT` | Версия Traefik и порты |
| `AUTH_REQUIRED`, `AUTH_JWT_SECRET`, `AUTH_ISSUER`, `AUTH_PORTAL_URL` | SSO через auth-portal |

Для SSO с auth-portal:

```env
AUTH_REQUIRED=true
AUTH_JWT_SECRET=<тот же JWT_SECRET что на портале>
AUTH_ISSUER=https://auth.shnt.top
AUTH_PORTAL_URL=https://auth.shnt.top
```

На стороне портала `VPS_DOMAIN` должен быть в `RETURN_TO_ALLOWLIST` (см. [auth-portal deploy-traefik](https://git.shts.su/denozord/auth-portal/src/branch/main/docs/deploy-traefik.md)).

---

## 3. Запуск

```bash
cd /opt/vps-tracker

# GHCR (публичный / с PAT):
docker login ghcr.io
# или приватный Gitea:
# docker login git.shts.su

docker compose pull
docker compose up -d
docker compose ps
docker compose logs -f --tail=100
```

Сервисы:

| Service | Контейнер | Роль |
|---------|-----------|------|
| `traefik` | `vps-tracker-traefik` | :80 → HTTPS, ACME DNS-01, роутинг |
| `app` | `vps-tracker` | приложение на сети `vps-tracker`, порт **3001** |

Первая выдача сертификата обычно 30–90 с.

### Проверка

```bash
curl -fsS https://vps.example.com/health
# {"ok":true}

echo | openssl s_client -connect vps.example.com:443 -servername vps.example.com 2>/dev/null \
  | openssl x509 -noout -issuer -dates -subject

docker compose logs traefik 2>&1 | grep -iE 'acme|certificate|cloudflare|error'
```

Откройте в браузере `https://vps.example.com`.

### Обновление / остановка

```bash
cd /opt/vps-tracker
docker compose pull
docker compose up -d

# остановка (тома и ./data сохраняются)
docker compose down

# НЕ делайте down -v без бэкапа — сотрёт ACME (том vps_tracker_traefik_letsencrypt)
```

Откат образа: в `.env` `VPS_TRACKER_IMAGE_TAG=<sha-или-тег>` → `docker compose pull && docker compose up -d`.

---

## Что внутри compose

- Сеть Docker **`vps-tracker`** (внутренняя).
- Том **`vps_tracker_traefik_letsencrypt`** → `/letsencrypt/acme.json`.
- Том хоста **`./data`** → SQLite VPS Tracker (`/app/data` в контейнере).
- Labels на `app`: `Host(VPS_DOMAIN)`, `entrypoints=websecure`, `certresolver=letsencrypt`, backend port `3001`.
- Порт приложения **не** публикуется на хост — снаружи только Traefik `:80` / `:443`.
- `CF_DNS_API_TOKEN` только у сервиса `traefik`.

Полный файл: [`deploy/docker-compose.traefik.yml`](../deploy/docker-compose.traefik.yml).

---

## Бэкап

```bash
# SQLite
cp /opt/vps-tracker/data/vps-tracker.db \
  /opt/vps-tracker/data/vps-tracker.db.bak-$(date +%F)

# ACME (Let's Encrypt)
docker run --rm -v vps_tracker_traefik_letsencrypt:/data -v "$PWD:/backup" alpine \
  tar czf /backup/traefik-acme-$(date +%F).tgz -C /data .
```

---

## Troubleshooting

| Симптом | Что проверить |
|---------|----------------|
| `Bind for 0.0.0.0:80/443 failed` | Другой Traefik/nginx занимает порты |
| ACME / браузер ругается на сертификат | `CF_DNS_API_TOKEN`, Zone:DNS:Edit, DNS only (не orange cloud), логи Traefik |
| `invalid credentials` | Не Global Key; зона в scope токена; нет пробелов/кавычек в `.env` |
| Gateway Timeout / 404 | `docker compose ps`; labels; сеть `vps-tracker`; `VPS_DOMAIN` |
| `/health` OK, `/api/data` 500 | Старые образы без bootstrap схемы — `docker compose pull && up -d`; смотрите `docker compose logs app` (`no such table`) |
| `/health` OK, UI пустой | образ / кэш CDN; смотрите `docker compose logs app` |
| SSO 401 / issuer mismatch | `AUTH_JWT_SECRET` = `JWT_SECRET` портала; `AUTH_ISSUER` |

```bash
docker compose logs traefik 2>&1 | grep -iE 'acme|certificate|cloudflare|error'
docker compose logs app --tail=80
docker compose logs -f app   # follow
```

Логи контейнеров: драйвер `json-file`, ротация `max-size=10m`, `max-file=3`. Уровень приложения — `LOG_LEVEL` (по умолчанию `info`).

---

## Простой compose без Traefik

Локально / за своим reverse-proxy: корневой [`docker-compose.yml`](../docker-compose.yml) с пробросом `3001:3001` — см. [README](../README.md#compose).
