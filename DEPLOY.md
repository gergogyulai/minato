# Deploying Minato

Minato ships as a single Docker image that runs the API server, background workers, and static frontend behind an nginx reverse proxy — all managed by supervisord. External dependencies (PostgreSQL, Redis, Meilisearch) run as separate containers.

## Prerequisites

- Docker 24+ and Docker Compose v2
- A [TMDB API Read Access Token](https://developer.themoviedb.org/docs/getting-started)

---

## Quick Start (Docker Compose)

**1. Create a `docker-compose.yml`**

```yaml
services:
  minato:
    image: gergogyulai/minato:latest
    container_name: minato
    restart: unless-stopped
    ports:
      - "7271:7271"
    networks:
      - internal-minato
    environment:
      - NODE_ENV=production
      - BETTER_AUTH_SECRET=${BETTER_AUTH_SECRET}
      - DATABASE_URL=postgresql://minato_user:${DB_PASSWORD}@postgres:5432/minato
      - TMDB_READ_ACCESS_TOKEN=${TMDB_READ_ACCESS_TOKEN}
      - REDIS_URL=redis://redis:6379
      - MEILISEARCH_HOST=http://meilisearch:7700
      - MEILISEARCH_MASTER_KEY=${MEILI_MASTER_KEY}
      - MEDIA_ROOT=/data/media
    volumes:
      - minato_assets:/data
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy

  postgres:
    image: postgres:16-alpine
    container_name: minato-db
    restart: unless-stopped
    networks:
      - internal-minato
    environment:
      - POSTGRES_DB=minato
      - POSTGRES_USER=minato_user
      - POSTGRES_PASSWORD=${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U minato_user -d minato"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: minato-redis
    restart: unless-stopped
    networks:
      - internal-minato
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5

  meilisearch:
    image: getmeili/meilisearch:v1.12
    container_name: minato-search
    restart: unless-stopped
    networks:
      - internal-minato
    environment:
      - MEILI_MASTER_KEY=${MEILI_MASTER_KEY}
      - MEILI_NO_ANALYTICS=true
    volumes:
      - meilisearch_data:/meili_data

networks:
  internal-minato:
    driver: bridge

volumes:
  minato_assets:
  postgres_data:
  redis_data:
  meilisearch_data:
```

**2. Create a `.env` file**

```env
# Required — generate with: openssl rand -base64 32
BETTER_AUTH_SECRET=

# Required — strong password for the postgres user
DB_PASSWORD=

# Required — Meilisearch master key (generate with: openssl rand -hex 32)
MEILI_MASTER_KEY=

# Required — TMDB Read Access Token (https://developer.themoviedb.org)
TMDB_READ_ACCESS_TOKEN=
```

**3. Start**

```bash
docker compose up -d
```

The UI is available at `http://localhost:7271`. Database migrations run automatically on first boot.

---

## Environment Variables

| Variable | Required | Description |
| --- | --- | --- |
| `BETTER_AUTH_SECRET` | Yes | Secret key for session signing. Min 32 chars. |
| `DATABASE_URL` | Yes | PostgreSQL connection string. |
| `REDIS_URL` | Yes | Redis connection string. Defaults to `redis://localhost:6379`. |
| `MEILISEARCH_HOST` | Yes | Meilisearch base URL. |
| `MEILISEARCH_MASTER_KEY` | Yes | Meilisearch master key. |
| `TMDB_READ_ACCESS_TOKEN` | Yes | TMDB v4 Read Access Token for metadata enrichment. |
| `MEDIA_ROOT` | Yes | Path inside the container for media assets. Use `/data/media`. |
| `BETTER_AUTH_URL` | No | Public URL of the deployment (e.g. `https://minato.example.com`). |
| `CORS_ORIGIN` | No | Allowed CORS origin if the frontend is served from a different domain. |
| `NODE_ENV` | No | Set to `production`. |

---

## Building the Image Locally

```bash
git clone https://github.com/gergogyulai/minato.git
cd minato

docker build -t minato:local .
```

Then replace `image: gergogyulai/minato:latest` with `image: minato:local` in the compose file.

---

## Reverse Proxy (Traefik)

To put Minato behind Traefik with TLS:

```yaml
services:
  minato:
    # ... same as above, remove the `ports` block ...
    networks:
      - internal-minato
      - web-public
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.minato.rule=Host(`minato.example.com`)"
      - "traefik.http.routers.minato.entrypoints=websecure"
      - "traefik.http.routers.minato.tls.certresolver=letsencrypt"
      - "traefik.http.services.minato.loadbalancer.server.port=7271"
    environment:
      - BETTER_AUTH_URL=https://minato.example.com
      # ... rest of env vars ...

networks:
  internal-minato:
    driver: bridge
  web-public:
    external: true
```

---

## Data Persistence

| Volume | Contents |
| --- | --- |
| `minato_assets` | Media files (posters, backdrops) stored under `/data/media` |
| `postgres_data` | PostgreSQL data directory |
| `redis_data` | Redis persistence |
| `meilisearch_data` | Meilisearch index data |

Back up all four volumes to avoid data loss.

---

## Ports

| Port | Service |
| --- | --- |
| `7271` | Nginx — serves the frontend and proxies `/api/` to the Hono backend |

No other ports need to be exposed. All internal services communicate over the `internal-minato` Docker network.

---

## Updating

```bash
docker compose pull
docker compose up -d
```

Migrations run automatically on startup, so no manual steps are needed after a version bump.
