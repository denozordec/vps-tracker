# syntax=docker/dockerfile:1

ARG NODE_IMAGE=node:22-alpine

############################
# Stage 1: build web + api
############################
FROM ${NODE_IMAGE} AS build
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
RUN pnpm --filter web build \
 && pnpm --filter api build

############################
# Stage 2: production deps
############################
FROM ${NODE_IMAGE} AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/web/package.json ./apps/web/
COPY apps/api/package.json ./apps/api/
COPY packages/ui/package.json ./packages/ui/
COPY packages/shared/package.json ./packages/shared/
COPY packages/db/package.json ./packages/db/
RUN --mount=type=cache,target=/root/.local/share/pnpm pnpm install --frozen-lockfile --prod \
 && find node_modules -type f \( \
      -name '*.md' -o -name '*.map' -o -name 'LICENSE*' -o -name 'CHANGELOG*' \
      -o -name 'README*' -o -name '.npmignore' -o -name '.eslintrc*' -o -name '.travis.yml' \
      -o -name 'Makefile' -o -name '*.gyp' -o -name '*.gypi' \
    \) -delete \
 && find node_modules -type d -empty -delete

############################
# Stage 3: runtime (no npm/pnpm)
############################
FROM alpine:3.21
RUN apk add --no-cache nodejs
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=deps /app/packages/ui/node_modules ./packages/ui/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=deps /app/packages/db/node_modules ./packages/db/node_modules
COPY --from=build /app/apps/web/dist ./apps/web/dist
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/db ./apps/api/db
COPY --from=build /app/apps/api/adapters ./apps/api/adapters
COPY --from=build /app/apps/api/index.js ./apps/api/index.js
COPY --from=build /app/apps/api/utils ./apps/api/utils
COPY --from=build /app/apps/api/projects-service.js ./apps/api/projects-service.js
COPY --from=build /app/apps/api/sync-scheduler.js ./apps/api/sync-scheduler.js
COPY --from=build /app/apps/api/sync-account-job.js ./apps/api/sync-account-job.js
COPY --from=build /app/apps/api/telegram.js ./apps/api/telegram.js
EXPOSE 3001
# Default runtime: legacy Express server (sync still pending migration to Fastify).
# Set RUNTIME=fastify to use the new Fastify stack.
ENV RUNTIME=express
CMD ["sh", "-c", "if [ \"$RUNTIME\" = \"fastify\" ]; then node apps/api/dist/index.js; else node apps/api/index.js; fi"]
