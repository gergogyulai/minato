# --- Stage 1: Build all apps (project-minato monorepo) ---
FROM oven/bun:1.3.9 AS builder
WORKDIR /app

ENV NODE_ENV=production

COPY package.json bun.lock turbo.json biome.json tsconfig.json ./
COPY patches ./patches
# Copy only the apps needed for production (exclude docs — its fumadocs-mdx postinstall
# script tries to compile source.config.ts with esbuild and fails in a Linux container)
COPY apps/server ./apps/server
COPY apps/jobs ./apps/jobs
COPY apps/web ./apps/web
COPY packages ./packages

RUN bun install --ignore-scripts

# Build server (tsdown → apps/server/dist) and web (vite → apps/web/dist)
# jobs has no build step — it is run directly from source by bun at runtime
RUN bun run build

# --- Stage 2: Final Production Image ---
FROM oven/bun:1.3.9-slim
WORKDIR /app

RUN apt-get update && apt-get install -y \
  supervisor \
  nginx \
  && rm -rf /var/lib/apt/lists/*

## copy frontend static assets — served by nginx
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html

## copy server bundle
COPY --from=builder /app/apps/server/dist ./apps/server/dist
COPY --from=builder /app/apps/server/package.json ./apps/server/package.json

## copy jobs source (no build step — bun runs TypeScript directly)
COPY --from=builder /app/apps/jobs/src ./apps/jobs/src
COPY --from=builder /app/apps/jobs/package.json ./apps/jobs/package.json

## copy workspace packages (runtime deps for jobs)
COPY --from=builder /app/packages ./packages

## copy production dependencies (workspace symlinks are dereferenced by Docker COPY)
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

## copy nginx config
COPY docker/nginx.conf /etc/nginx/sites-available/default

## copy supervisor config
COPY docker/supervisord.conf /etc/supervisor/conf.d/supervisord.conf

ENV MEDIA_ROOT=/data/media
ENV NODE_ENV=production

RUN mkdir -p /data/media

VOLUME /data

EXPOSE 7271

CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]