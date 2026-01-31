# Project Blueprint: "Project Minato"

A high-performance torrent scraping and indexing suite with a Torznab-compatible API, Next.js dashboard, and Go-based public tracker scrapers (The Pirate Bay, 1337x, knaben.org) and DHT crawlers.

## 1. System Architecture

*   **Frontend**: React, Tailwind, Lucide-React, TanStack Query.
*   **API**: Hono/TypeScript running on Bun. Handles Torznab XML, user authentication, data ingestion, and dashboard logic.
*   **Scrapers**: Multiple Go services (utilizing `anacrolix/torrent` for DHT/P2P interactions).
*   **Databases**: 
    *   **PostgreSQL**: Source of truth (Metadata, User Accounts, API Keys).
    *   **Meilisearch**: Full-text search engine for torrent titles.
*   **Internal Proxy**: Nginx (Consolidates the UI and API onto port `7271`).

### 1.a Stack

**Frontend:**
- **Framework**: Next.js 16 using the App Router.
- **Styling**: Tailwind CSS for a modern, responsive dashboard (using shadcn components).
- **Icons**: Lucide-React.
- **Data Fetching**: TanStack Query for efficient client-side caching.

**Backend (API & Management):**
- **Runtime**: Bun (high-speed execution and native TypeScript support).
- **Framework**: Hono (lightweight, for both the Dashboard API and the Torznab XML endpoints).
- **Authentication**: **BetterAuth** (authentication, handles SSO, session management).
- **Database Layer**: Drizzle ORM (type-safe SQL builder for PostgreSQL).

**Scrapers (The "Go" Engine):**
- **Language**: Go (optimized for low-memory P2P networking).
- **Libraries**: `anacrolix/torrent` for DHT/P2P; `colly` or `rod` for site-specific scraping.
- **Internal Auth**: Shared `INTERNAL_AUTH_KEY` passed via headers for scraper-to-API communication.

**Search & Persistence:**
- **Primary Database**: PostgreSQL (Source of truth for metadata, API keys, and BetterAuth tables).
- **Search Engine**: Meilisearch (powering full-text search across millions of indexed titles), find files by names inside the indexed metadata.
- **Persistence Strategy**: No external cache (Redis) required; PostgreSQL handles relational state, while Meilisearch handles high-concurrency search queries.

**DevOps & Tooling:**
- **Monorepo**: Turborepo (managing the `apps/`, `services/`, and `packages/` workspaces).
- **Package Manager**: Bun/NPM.
- **Process Management**: Supervisord (used within the Docker image to keep the Go scrapers and the TS API running concurrently).

---

## 2. Directory Structure (Monorepo)

```text
/
├── apps/
│   ├── web/                # Next.js Frontend
│   └── api/                # TS Backend (Torznab + Management)
├── services/
│   ├── dht-scraper/        # Go: DHT Crawler
│   ├── 1337x-crawlers/     # Go: 1337x scrapers
│   ├── knaben-crawlers/    # Go: Knaben scrapers
│   ├── other-crawlers/     # Go: Targeted site scrapers
│   └── shared/             # Shared Go utilities & types
├── packages/
│   ├── database/           # Drizzle Schema + Migrations
│   ├── auth/               # Shared Auth & Hashing logic (BetterAuth)
│   └── types/              # Shared TS Interfaces
├── deploy/
│   ├── docker-compose.yml  # Production deployment
│   ├── supervisord.conf    # Process manager for standalone image
│   └── nginx.conf          # Internal reverse proxy
├── go.work                 # Go Workspace
├── turbo.json              # Turborepo config
└── package.json            # Root configuration
```

---

## 3. Security Model

| Traffic Type | Auth Method | Permission |
| :--- | :--- | :--- |
| **User -> UI** | BetterAuth | Full Admin access |
| **Sonarr/Radarr -> API** | `?apikey=` (User Generated) | Read-only Torznab |
| **Go Scraper -> API** | `X-Internal-Secret` (Auto-generated) | Write-only Indexing |
| **Services -> DB** | Internal Docker Network | Full access |

---

## 4. Planned Features

- A dashboard for managing torrents from all sources.
- A self-hosted private tracker, allowing view-only users to browse the collection as a public tracker while admins manage content.
- DHT crawling will be initially powered by a bitmagnet instance. A standalone crawler written from the ground up is planned
- Provide configurable base URLs for crawled sites, allowing users to select their preferred proxies (e.g., PirateBay mirrors) to ensure optimal connectivity and access.
- Extensible RSS feed crawling letting users add and configure their own feeds if the native scrapers are insufficient.
- Specialized site crawlers (TPB, 1337x, EZTV, Knaben, etc.).
- SSO Authentication for admin access.
- Secure API authentication between internal services using a generated `INTERNAL_AUTH_KEY`.
- Admin capability to generate and revoke API keys.
- Synchronization of PostgreSQL rows into Meilisearch.
- Ingestion of torrents scraped via custom methods (e.g., RARBG dumps or external SQLite DBs), External Ingestion API.
- Export functionality for portable SQLite databases for backup or archival purposes.
- Content classification (making the database searchable by TMDB or IMDb IDs).
- Internal monitoring and Prometheus endpoints for Grafana integration.

---

## 5. Deployment (The "User" Experience)

Users will deploy using a simple `docker-compose.yml`:

```yaml
version: '3.8'

services:
  # Contains the Next.js web application, the Hono API, the Go scrapers, 
  # and a reverse proxy to tie everything together.
  minato:
    image: gergogyulai/minato:latest
    environment:
      - DATABASE_URL=postgresql://user:${DB_PASSWORD}@postgres:5432/indexer
      - Meilisearch_URL=http://Meilisearch:9200
    volumes:
      - ./config:/app/config
    networks:
      - web-public
      - minato-internal
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.indexer.rule=Host(`${DOMAIN}`)"
      - "traefik.http.services.indexer.loadbalancer.server.port=7271"

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - pg_data:/var/lib/postgresql/data
    networks:
      - minato-internal

  Meilisearch:
    image: docker.elastic.co/Meilisearch/Meilisearch:8.12.0
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=false
    volumes:
      - es_data:/usr/share/Meilisearch/data
    networks:
      - minato-internal

networks:
  web-public:
    external: true
  minato-internal:

volumes:
  pg_data:
  es_data:
```