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

# Минимальный runtime (см. https://github.com/GoogleContainerTools/distroless/blob/main/nodejs/README.md)
FROM gcr.io/distroless/nodejs22-debian13:nonroot
WORKDIR /app
ENV NODE_ENV=production
COPY --from=bundle --chown=nonroot:nonroot /out/ .
EXPOSE 3001
CMD ["server/index.js"]
