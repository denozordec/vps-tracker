# syntax=docker/dockerfile:1

# Сборка фронта (devDependencies только здесь)
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
  npm ci
COPY index.html vite.config.js ./
COPY public ./public
COPY src ./src
RUN npm run build

# Production node_modules + server + dist
FROM node:22-alpine AS prod
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
  npm ci --omit=dev
COPY server ./server
COPY --from=build /app/dist ./dist

# Слой приложения одним COPY в финальный образ (меньше слоёв в image)
FROM node:22-alpine AS bundle
WORKDIR /out
COPY --from=prod /app/node_modules ./node_modules
COPY --from=prod /app/server ./server
COPY --from=prod /app/dist ./dist
COPY --from=prod /app/package.json ./package.json

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=bundle /out/ .
EXPOSE 3001
CMD ["node", "server/index.js"]
