# syntax=docker/dockerfile:1

# Stage 1: Сборка фронтенда
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci
COPY index.html vite.config.js ./
COPY public ./public
COPY src ./src
RUN npm run build

# Stage 2: Production dependencies + очистка node_modules
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev && \
    find node_modules -type f \( \
      -name '*.md' -o -name '*.ts' -o -name '*.map' -o \
      -name 'LICENSE*' -o -name 'CHANGELOG*' -o -name 'README*' -o \
      -name '.npmignore' -o -name '.eslintrc*' -o -name '.travis.yml' -o \
      -name 'Makefile' -o -name '*.gyp' -o -name '*.gypi' \
    \) -delete && \
    find node_modules -type d -empty -delete

# Stage 3: Минимальный runtime — только бинарник node (без apk, npm, yarn)
FROM alpine:3.21
RUN apk add --no-cache libstdc++ libgcc
COPY --from=node:22-alpine /usr/local/bin/node /usr/local/bin/node
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY server ./server
EXPOSE 3001
CMD ["node", "server/index.js"]
