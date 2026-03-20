# syntax=docker/dockerfile:1

# Сборка фронта (все devDependencies + UI)
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
  npm ci
COPY index.html vite.config.js ./
COPY public ./public
COPY src ./src
RUN npm run build

# Только runtime-deps: express, cors, sql.js (+ транзитивные)
FROM node:22-alpine AS prod
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
  npm ci --omit=dev
COPY server ./server
COPY --from=build /app/dist ./dist

# Артефакты без package.json / lock — не нужны для node server/index.js
FROM node:22-alpine AS bundle
WORKDIR /out
COPY --from=prod /app/node_modules ./node_modules
COPY --from=prod /app/server ./server
COPY --from=prod /app/dist ./dist

# Финал на Alpine: у базы меньше слоёв, чем у distroless Debian (history выглядит «легче»).
# Тяжёлый фронт в образ не попадает — только express/cors/sql.js (стадия prod).
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=bundle /out/ .
EXPOSE 3001
CMD ["node", "server/index.js"]
