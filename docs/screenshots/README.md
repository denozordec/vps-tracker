# Скриншоты

Скриншоты в README и `docs/` сняты на **демо-данных**: хостеры вымышленные (Nordhost, Aurora Cloud, Baltic VDS, Pixel Hosting), IP — из документационных диапазонов RFC 5737 (`203.0.113.0/24`, `198.51.100.0/24`, `192.0.2.0/24`), домены — `*.example.net`.

## Как пересоздать

Нужны собранный фронтенд и Chrome/Chromium/Edge.

```bash
pnpm install
pnpm --filter web build
pnpm --filter @cfdm/shared build && pnpm --filter @cfdm/db build
```

1. Поднять демо на пустой базе (порт 3101, без планировщика):

   ```bash
   cd apps/api
   rm -f ../../data/demo.db*
   DB_PATH=../../data/demo.db VITEST=1 LOG_LEVEL=warn npx tsx scripts/seed-demo.ts --serve
   ```

2. В другом терминале из корня репозитория снять все экраны:

   ```bash
   node apps/api/scripts/docs-screenshots.mjs docs/screenshots
   ```

   Путь к браузеру — переменная `CHROME`, адрес демо — `BASE`.

Список экранов и их параметры (размер окна, клик по вкладке, прокрутка, мобильный режим) — в начале [`docs-screenshots.mjs`](../../apps/api/scripts/docs-screenshots.mjs). Демо-данные — [`seed-demo.ts`](../../apps/api/scripts/seed-demo.ts).

Файлы в репозитории дополнительно ужаты до 256-цветной палитры (тёмная тема переносит это без видимых потерь), чтобы README грузился быстрее.
