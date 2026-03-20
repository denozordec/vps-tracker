# VPS Tracker

**VPS Tracker** — это веб-приложение для учёта виртуальных серверов, хостинг-провайдеров, счетов и балансов. Всё работает в браузере: данные хранятся у вас на компьютере или сервере, можно подключить синхронизацию с BILLmanager.

Ниже описано, как **запустить готовую программу в Linux** с помощью Docker. Отдельно устанавливать Node.js не нужно.

---

## Содержание

1. [Что понадобится](#req)
2. [Самый простой способ: готовый образ](#quick)
3. [Запуск через Docker Compose](#compose)
4. [Сборка образа у себя](#build-local)
5. [Сохранение данных и резервная копия](#data)
6. [Другой порт и доступ по сети](#port)
7. [Обновление программы](#update)
8. [Для разработчиков](#dev)

---

<span id="req"></span>

## Что понадобится

- Компьютер или сервер с **Linux** (подойдут Ubuntu, Debian, Fedora и другие дистрибутивы).
- Установленные **Docker** и плагин **Compose**. Официальные инструкции: [Установка Docker Engine](https://docs.docker.com/engine/install/) и обзор [Compose](https://docs.docker.com/compose/).

Проверка в терминале:

```bash
docker --version
docker compose version
```

---

<span id="quick"></span>

## Самый простой способ: готовый образ

Подойдёт, если у вас есть только терминал и вы хотите быстро поднять сервис.

### Шаг 1. Скачать образ

```bash
docker pull ghcr.io/denozordec/vps-tracker:latest
```

> **Если запросили логин:** пакет на GitHub может быть закрытым. Войдите в аккаунт GitHub и создайте [Personal Access Token](https://github.com/settings/tokens) с правом `read:packages`, затем выполните:
>
> ```bash
> echo ВАШ_ТОКЕН | docker login ghcr.io -u ВАШ_ЛОГИН_GITHUB --password-stdin
> ```
>
> Либо откройте на GitHub страницу пакета **vps-tracker** → **Package settings** и сделайте пакет **public** — тогда `docker pull` без входа.

### Шаг 2. Папка для данных

Все записи приложения лежат в одном файле базы. Его нужно хранить **вне** контейнера, иначе при удалении контейнера данные пропадут.

```bash
mkdir -p ~/vps-tracker-data
```

Можно выбрать любой каталог вместо `~/vps-tracker-data` — главное, запомнить путь для команды ниже.

### Шаг 3. Запуск

**Вариант А — в фоне** (удобно на сервере, контейнер переживёт закрытие терминала):

```bash
docker run -d \
  --name vps-tracker \
  --restart unless-stopped \
  -p 3001:3001 \
  -v ~/vps-tracker-data:/app/data \
  ghcr.io/denozordec/vps-tracker:latest
```

**Вариант Б — в переднем плане** (логи видны в терминале, остановка — `Ctrl+C`):

```bash
docker run --rm \
  -p 3001:3001 \
  -v ~/vps-tracker-data:/app/data \
  ghcr.io/denozordec/vps-tracker:latest
```

### Шаг 4. Открыть в браузере

На той же машине откройте:

**http://localhost:3001**

Если заходите с другого компьютера в сети — подставьте IP сервера: `http://192.168.1.10:3001` (ваш адрес может отличаться). На сервере может понадобиться открыть порт в брандмауэре, например для Ubuntu с UFW:

```bash
sudo ufw allow 3001/tcp
sudo ufw reload
```

Остановка фонового контейнера:

```bash
docker stop vps-tracker
docker rm vps-tracker
```

---

<span id="compose"></span>

## Запуск через Docker Compose

Имеет смысл, если вы **склонировали этот репозиторий** и хотите собирать или менять конфигурацию через файл [docker-compose.yml](docker-compose.yml).

```bash
git clone https://github.com/denozordec/vps-tracker.git
cd vps-tracker
docker compose up -d --build
```

Данные по умолчанию сохраняются в папку `data` внутри каталога проекта на диске.

Остановка:

```bash
docker compose down
```

---

<span id="build-local"></span>

## Сборка образа у себя

Если нужен свой образ из исходников (после `git clone`):

```bash
cd vps-tracker
docker build -t vps-tracker:local .
mkdir -p ./data
docker run -d \
  --name vps-tracker \
  --restart unless-stopped \
  -p 3001:3001 \
  -v "$(pwd)/data:/app/data" \
  vps-tracker:local
```

---

<span id="data"></span>

## Сохранение данных и резервная копия

Файл базы в примерах выше лежит на хосте:

| Способ запуска | Где лежит база на диске |
|----------------|-------------------------|
| `docker run` с `-v ~/vps-tracker-data:/app/data` | `~/vps-tracker-data/vps-tracker.db` |
| Docker Compose из репозитория | `./data/vps-tracker.db` в папке проекта |

Скопируйте файл `vps-tracker.db` в безопасное место — это и есть резервная копия. Пока приложение не запущено, можно просто скопировать файл обратно для восстановления.

---

<span id="port"></span>

## Другой порт и доступ по сети

Внутри контейнера приложение слушает порт **3001**. Сменить внешний порт (например, **8080** снаружи, 3001 внутри):

```bash
docker run -d \
  --name vps-tracker \
  --restart unless-stopped \
  -p 8080:3001 \
  -v ~/vps-tracker-data:/app/data \
  ghcr.io/denozordec/vps-tracker:latest
```

Тогда в браузере: **http://localhost:8080**

Чтобы сменить и внутренний порт (редко нужно), добавьте `-e PORT=8080` и согласуйте с `-p`, например `-p 8080:8080` и `-e PORT=8080`.

---

<span id="update"></span>

## Обновление программы

Если используете образ с GitHub:

```bash
docker pull ghcr.io/denozordec/vps-tracker:latest
docker stop vps-tracker
docker rm vps-tracker
```

Затем снова выполните команду `docker run` из раздела [«Самый простой способ»](#quick) (том `-v ...:/app/data` оставьте тот же — данные сохранятся).

При Docker Compose из репозитория:

```bash
cd vps-tracker
git pull
docker compose up -d --build
```

---

<span id="dev"></span>

## Для разработчиков

Локальный запуск без Docker: `npm install` и `npm run dev`. Подробности по коду, API и синхронизации — в [AGENTS.md](AGENTS.md).
