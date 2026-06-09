> **Pre-alpha.** This project is under active development. Expect bugs, breaking changes, and incomplete features. Not ready for production use.

<div align="center">
  <br>
  <br>
  <span style="font-size: 4rem;">港</span>
  <br>
  <h1>Minato</h1>
  <sub>/miːˈnɑːtoʊ/ &nbsp;—&nbsp; Japanese for <i>harbor</i></sub>
  <br>
  <br>
  <strong>Your index, permanently.</strong>
  <br>
  <br>
</div>

Minato is a self-hosted torrent indexer. Browse releases from the dashboard, or connect it to Sonarr and Radarr via Torznab. It scrapes, enriches, and indexes — so you always have something to search. [Read the docs →](https://minato-docs.vercel.app)

- 🏠 Self-hosted torrent indexer
- 🔍 Full-text search with inline directives
- 📡 Torznab-compatible API (Sonarr, Radarr, Prowlarr)
- 🔌 Pluggable scraper system with lifecycle management
- ⚡ Single container, sub-300ms cold start
- 🎬 Automatic TMDB & AniList metadata enrichment
- 🔑 API keys, passkeys, role-based access
- 🧩 BullMQ-powered worker pipeline

## Quick Start

```yaml
# docker-compose.yaml
name: minato

services:
  minato:
    image: gergogyulai/minato:latest
    restart: unless-stopped
    ports:
      - "7271:7271"
    environment:
      BETTER_AUTH_SECRET: ${BETTER_AUTH_SECRET}
      DATABASE_URL: postgresql://minato:${POSTGRES_PASSWORD}@postgres:5432/minato
      MEILISEARCH_MASTER_KEY: ${MEILISEARCH_MASTER_KEY}
      TMDB_READ_ACCESS_TOKEN: ${TMDB_READ_ACCESS_TOKEN}
      OPENROUTER_API_KEY: ${OPENROUTER_API_KEY:-}
    volumes:
      - minato_config:/config
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
      meilisearch:
        condition: service_healthy

  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: minato
      POSTGRES_USER: minato
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    command: redis-server --save 60 1 --loglevel warning
    volumes:
      - redis_data:/data

  meilisearch:
    image: getmeili/meilisearch:v1.12
    restart: unless-stopped
    environment:
      MEILI_MASTER_KEY: ${MEILISEARCH_MASTER_KEY}
      MEILI_NO_ANALYTICS: "true"
    volumes:
      - meilisearch_data:/meili_data

volumes:
  minato_config:
  postgres_data:
  redis_data:
  meilisearch_data:
```

```bash
# .env
BETTER_AUTH_SECRET=
POSTGRES_PASSWORD=
MEILISEARCH_MASTER_KEY=
TMDB_READ_ACCESS_TOKEN=
```

| Variable | How to get it |
|---|---|
| `BETTER_AUTH_SECRET` | `openssl rand -base64 32` |
| `POSTGRES_PASSWORD` | Pick a strong password |
| `MEILISEARCH_MASTER_KEY` | `openssl rand -hex 32` |
| `TMDB_READ_ACCESS_TOKEN` | [developer.themoviedb.org](https://developer.themoviedb.org/docs/getting-started) |

```bash
docker compose up -d
```

Open `http://localhost:7271`. You'll hit the setup wizard to create your admin account.

## Contribute

This is a personal project, built in the open. Ideas, issues, and PRs are welcome — open an issue or dive into the [architecture doc](./ARCHITECTURE.md) to get oriented.

## License

[MIT](./LICENSE)

<br>
<p align="center">
  <sub>built in the open, one harbor at a time</sub>
</p>
