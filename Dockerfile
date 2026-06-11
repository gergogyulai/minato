# --- Stage 1: Build all apps (project-minato monorepo) ---
FROM oven/bun:1.3.9 AS builder
WORKDIR /app

# Do NOT set NODE_ENV=production here — Bun skips devDependencies when it is set,
# and we need drizzle-kit (a devDependency) to generate migrations during the build.

COPY package.json bun.lock turbo.json biome.json tsconfig.json ./
COPY patches ./patches
# Copy only the apps needed for production (exclude docs — its fumadocs-mdx postinstall
# script tries to compile source.config.ts with esbuild and fails in a Linux container)
COPY apps/server ./apps/server
COPY apps/jobs ./apps/jobs
COPY apps/web ./apps/web
COPY apps/scraper ./apps/scraper
COPY packages ./packages

RUN bun install --ignore-scripts

# Migrations are authored locally with `bun run db:generate` and committed to
# the repo — they are the source of truth. We don't regenerate at build time.

# Build server (tsdown → apps/server/dist), jobs (tsdown → apps/jobs/dist) and web (vite → apps/web/dist)
RUN bun run build

# tsdown bundles to a single ESM file and shims __dirname to the output dir;
# the migration runner resolves migrations relative to __dirname, so we copy
# them next to each bundle that runs migrations at boot.
RUN cp -r packages/db/src/migrations apps/server/dist/migrations \
 && cp -r packages/db/src/migrations apps/jobs/dist/migrations

# Install first-party scraper dependencies at build time.
# Community scrapers are volume-mounted at runtime and get their deps installed
# by the supervisor on first spawn.
RUN for dir in /app/apps/scraper/*/; do \
      [ -f "$dir/package.json" ] && bun install --cwd "$dir" || true; \
    done

# --- Stage 2: Final Production Image ---
FROM oven/bun:1.3.9-alpine
WORKDIR /app

# supervisor, nginx, curl (for healthcheck)
RUN apk add --no-cache supervisor nginx curl

## Copy workspace manifests — bun install --production resolves the full dependency
## graph across all workspace members and installs everything in one command.
COPY --from=builder /app/package.json /app/bun.lock ./
COPY --from=builder /app/patches ./patches/
COPY --from=builder /app/apps/jobs/package.json ./apps/jobs/
COPY --from=builder /app/apps/server/package.json ./apps/server/
COPY --from=builder /app/packages/auth/package.json ./packages/auth/
COPY --from=builder /app/packages/config/package.json ./packages/config/
COPY --from=builder /app/packages/db/package.json ./packages/db/
COPY --from=builder /app/packages/env/package.json ./packages/env/
COPY --from=builder /app/packages/meilisearch/package.json ./packages/meilisearch/
COPY --from=builder /app/packages/queue/package.json ./packages/queue/
COPY --from=builder /app/packages/skit/package.json ./packages/skit/
COPY --from=builder /app/packages/utils/package.json ./packages/utils/

## Install ALL production dependencies in one simple step.
## Patches (e.g. release-parser) are resolved from the lockfile.
RUN bun install --production

## copy frontend static assets — served by nginx
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html

## copy server and jobs bundles (includes migrations next to each bundle)
COPY --from=builder /app/apps/server/dist ./apps/server/dist
COPY --from=builder /app/apps/jobs/dist ./apps/jobs/dist

## copy first-party scrapers (source + pre-installed node_modules from builder)
COPY --from=builder /app/apps/scraper ./apps/scraper

## Copy workspace source for packages that are resolved at runtime by the
## scraper supervisor (import.meta.resolve + child bun run).
COPY --from=builder /app/packages/skit ./packages/skit
COPY --from=builder /app/packages/utils ./packages/utils

## Bun already created symlinks for skit/utils above, but we overwrite with
## source-inclusive copies. Recreate symlinks to point to the full source dirs.
RUN mkdir -p node_modules/@project-minato \
  && ln -sf ../../packages/skit node_modules/@project-minato/skit \
  && ln -sf ../../packages/utils node_modules/@project-minato/utils

## copy nginx config (Alpine nginx uses http.d/, not sites-available/)
COPY docker/nginx.conf /etc/nginx/http.d/default.conf

## copy supervisor config
COPY docker/supervisord.conf /etc/supervisor/conf.d/supervisord.conf

ENV MEDIA_ROOT=/config/media
ENV NODE_ENV=production

RUN mkdir -p /config/media /config/scrapers /app/apps/scraper

VOLUME /config

EXPOSE 7271

HEALTHCHECK --interval=30s --timeout=10s --start-period5s --retries=3 \
  CMD curl -f http://localhost:7271/api/v1/health || exit 1

CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]