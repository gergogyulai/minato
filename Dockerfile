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

# --- Stage 2: Final Production Image ---
FROM oven/bun:1.3.9-alpine
WORKDIR /app

# supervisor and nginx — apk implicitly --no-cache avoids keeping the index
RUN apk add --no-cache supervisor nginx

## copy frontend static assets — served by nginx
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html

## copy server bundle
COPY --from=builder /app/apps/server/dist ./apps/server/dist

## copy jobs bundle
COPY --from=builder /app/apps/jobs/dist ./apps/jobs/dist

## Install external packages fresh:
##   - better-auth + @better-auth/* adapters: left external due to dynamic require()
##   - drizzle-orm: required at runtime by @better-auth/drizzle-adapter (dynamic require)
##   - sharp: native addon, needs Alpine/musl prebuilt (not the glibc one from builder)
COPY apps/jobs/package.json /tmp/jobs-pkg.json
RUN bun -e "const {readFileSync,writeFileSync}=require('fs'); \
  const jobs=JSON.parse(readFileSync('/tmp/jobs-pkg.json','utf8')); \
  writeFileSync('package.json',JSON.stringify({dependencies:{ \
    sharp:jobs.dependencies.sharp, \
    'better-auth':'^1.5.3', \
    '@better-auth/api-key':'^1.5.3', \
    '@better-auth/passkey':'^1.5.3', \
    '@better-auth/drizzle-adapter':'^1.5.3', \
    'drizzle-orm':'^0.45.1' \
  }}));" \
  && bun install --production \
  && rm package.json

## copy nginx config (Alpine nginx uses http.d/, not sites-available/)
COPY docker/nginx.conf /etc/nginx/http.d/default.conf

## copy supervisor config
COPY docker/supervisord.conf /etc/supervisor/conf.d/supervisord.conf

ENV MEDIA_ROOT=/data/media
ENV NODE_ENV=production

RUN mkdir -p /data/media

VOLUME /data

EXPOSE 7271

CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]