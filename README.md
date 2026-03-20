# VPS Tracker

Приложение для учёта виртуальных серверов (VPS), провайдеров, аккаунтов, платежей и балансов. Поддерживается синхронизация с BILLmanager 6 API.

Ниже — основной сценарий запуска **в Docker**. Разработка без контейнера описана кратко в конце. Подробности по коду и доменам — в [AGENTS.md](AGENTS.md).

---

## Запуск в Docker

### Требования

- [Docker](https://docs.docker.com/get-docker/) и [Docker Compose](https://docs.docker.com/compose/) v2 (`docker compose`).

### Важно: база данных

SQLite хранится в файле `data/vps-tracker.db` **внутри рабочей директории приложения** (`/app/data` в контейнере). Без **тома** (volume) при удалении или пересборке контейнера база пропадёт. Для постоянного хранения всегда монтируйте каталог на хосте в `/app/data`.

### Вариант 1: Docker Compose (рекомендуется)

В корне репозитория:

```powershell
docker compose up --build
```

Откройте в браузере: **http://localhost:3001** (и API на том же хосте, префикс `/api/...`).

Данные БД по умолчанию пишутся в `./data` на хосте (см. [docker-compose.yml](docker-compose.yml)). Каталог `data` можно создать заранее или он появится при первом запуске.

Остановка: `Ctrl+C` или в другом окне:

```powershell
docker compose down
```

### Вариант 2: только Docker (без Compose)

Сборка образа:

```powershell
docker build -t vps-tracker:local .
```

Запуск с томом для БД (пример для PowerShell — подставьте свой путь):

```powershell
New-Item -ItemType Directory -Force -Path .\data | Out-Null
docker run --rm -p 3001:3001 -v "${PWD}\data:/app/data" vps-tracker:local
```

Снова открывайте **http://localhost:3001**.

### Переменные окружения

| Переменная | Описание | По умолчанию |
|------------|----------|--------------|
| `PORT` | Порт HTTP внутри контейнера | `3001` |

При смене `PORT` пробросьте тот же порт наружу, например `-p 8080:8080` и `-e PORT=8080`.

### Образ из GitHub Container Registry (GHCR)

После push в ветку `main` workflow [.github/workflows/docker.yml](.github/workflows/docker.yml) собирает образ и публикует его в GHCR.

1. На GitHub: **Packages** → пакет образа для этого репозитория (при необходимости сделайте пакет **public**, чтобы не требовалась авторизация для `docker pull`).
2. Имя образа в GHCR: **`ghcr.io/denozordec/vps-tracker`** (теги `latest` и SHA коммита).

```powershell
docker pull ghcr.io/denozordec/vps-tracker:latest
New-Item -ItemType Directory -Force -Path .\data | Out-Null
docker run --rm -p 3001:3001 -v "${PWD}\data:/app/data" ghcr.io/denozordec/vps-tracker:latest
```

Обновление: снова `docker pull ghcr.io/denozordec/vps-tracker:latest` и перезапуск контейнера.

### CI/CD (кратко)

- **Pull request** в `main`: в GitHub Actions выполняется только **сборка** образа (проверка, что Dockerfile валиден).
- **Push** в `main`: сборка и **push** в GHCR с тегами `latest` и SHA коммита.

---

## Локальная разработка (без Docker)

```powershell
npm install
npm run dev
```

Поднимаются Vite (фронт) и Express (API); API по умолчанию на порту **3001**, прокси настроен в [vite.config.js](vite.config.js).

Сборка фронта отдельно: `npm run build`. Для проверки production-сборки на одном порту: после `npm run build` запустите `npm run server` — сервер отдаст статику из `dist`, если каталог существует.

---

## Документация для разработчиков

- [AGENTS.md](AGENTS.md) — структура репозитория, сущности, где искать sync, тарифы, API.
