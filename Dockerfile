# --- Stage 1: Build all apps (project-minato monorepo) ---
FROM oven/bun:1.3.9 AS builder
WORKDIR /app

COPY package.json bun.lock turbo.json biome.json tsconfig.json ./
COPY patches ./patches

# Clean approach to copy only what we need without bringing in apps/docs
COPY packages ./packages
COPY apps/server ./apps/server
COPY apps/jobs ./apps/jobs
COPY apps/web ./apps/web
COPY apps/scraper ./apps/scraper

RUN bun install --ignore-scripts

# Build server (tsdown), jobs (tsdown), and web (vite)
RUN bun run build

# Copy migrations next to the compiled bundles for runtime resolution
RUN cp -r packages/db/src/migrations apps/server/dist/migrations \
 && cp -r packages/db/src/migrations apps/jobs/dist/migrations

# Install first-party scraper dependencies
RUN for dir in /app/apps/scraper/*/; do \
      [ -f "$dir/package.json" ] && bun install --cwd "$dir" || true; \
    done


# --- Stage 2: Final Production Image ---
FROM oven/bun:1.3.9-alpine
WORKDIR /app

RUN apk add --no-cache supervisor nginx curl \
    && addgroup -S minato && adduser -S -G minato minato

# 1. SMART COPY: Grab ALL package.json files at once keeping directory structure.
# This eliminates the tedious list of manual copies and future-proofs the build.
COPY --from=builder /app/package.json /app/bun.lock ./
COPY --from=builder /app/patches ./patches/
COPY --from=builder /app/packages/ /app/packages/
COPY --from=builder /app/apps/server/package.json ./apps/server/
COPY --from=builder /app/apps/jobs/package.json ./apps/jobs/

# 2. Install production dependencies cleanly across the monorepo
RUN bun install --production

# 3. Copy compiled application artifacts
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html
COPY --from=builder /app/apps/server/dist ./apps/server/dist
COPY --from=builder /app/apps/jobs/dist ./apps/jobs/dist
COPY --from=builder /app/apps/scraper ./apps/scraper

# NOTE: Step 1 already brought in full source for packages/skit and packages/utils.
# Because bun install --production ran *after* those sources were present, Bun 
# automatically links them correctly. No manual 'ln -sf' hacks required.

# 4. Infrastructure Configurations
COPY docker/nginx.conf /etc/nginx/http.d/default.conf
COPY docker/supervisord.conf /etc/supervisor/conf.d/supervisord.conf

ENV MEDIA_ROOT=/config/media
ENV NODE_ENV=production

# 5. Permissions & Security Hardening
RUN mkdir -p /config/media /config/scrapers /app/apps/scraper \
    && sed -i '/^user nginx;/d' /etc/nginx/nginx.conf \
    && mkdir -p /var/lib/nginx/tmp/client_body /var/lib/nginx/tmp/proxy /var/log/nginx /run/nginx \
    && chown -R minato:minato /app /config /usr/share/nginx/html /var/lib/nginx /var/log/nginx /run/nginx

USER minato
VOLUME /config
EXPOSE 7271

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:7271/api/v1/health || exit 1

CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]