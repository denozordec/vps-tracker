# syntax=docker/dockerfile:1

############################
# Stage 1: build web + api + prune to prod deps
############################
FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY apps/web/package.json ./apps/web/
COPY apps/api/package.json ./apps/api/
COPY packages/ui/package.json ./packages/ui/
COPY packages/shared/package.json ./packages/shared/
COPY packages/db/package.json ./packages/db/
RUN --mount=type=cache,target=/root/.local/share/pnpm pnpm install --frozen-lockfile

COPY apps ./apps
COPY packages ./packages
RUN pnpm --filter @cfdm/shared build \
 && pnpm --filter @cfdm/db build \
 && pnpm --filter web build \
 && pnpm --filter api build \
 && pnpm prune --prod \
 && rm -rf apps/web/src apps/api/src packages/db/src packages/shared/src \
          apps/web/node_modules/.vite-temp \
          apps/web/tsconfig.json apps/api/tsconfig.json \
 && find node_modules apps/*/node_modules packages/*/node_modules -type f \( \
      -name '*.md' -o -name '*.map' -o -name '*.ts' -o -name 'LICENSE*' -o -name 'CHANGELOG*' \
      -o -name 'README*' -o -name '.npmignore' -o -name '.eslintrc*' -o -name '.travis.yml' \
      -o -name 'Makefile' -o -name '*.gyp' -o -name '*.gypi' \
    \) -delete 2>/dev/null || true \
 && find node_modules apps/*/node_modules packages/*/node_modules -type d -empty -delete 2>/dev/null || true

############################
# Stage 2: minimal runtime (alpine + nodejs only)
############################
FROM alpine:3.21
RUN apk add --no-cache nodejs
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3001 \
    RUNTIME=fastify
# Single layer for app code + pruned prod node_modules (symlinks resolved by COPY)
COPY --from=build /app ./
EXPOSE 3001
# RUNTIME=express — legacy fallback (apps/api/index.js)
CMD ["sh", "-c", "if [ \"$RUNTIME\" = \"express\" ]; then node apps/api/index.js; else node apps/api/dist/index.js; fi"]
