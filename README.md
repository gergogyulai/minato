> [!CAUTION]
> This project is currently in **active development**. Core infrastructure is functional, but user-facing features are still being refined and extended. The codebase is operational for development and production use.

> [!NOTE]
> **Open Source & Contributions**: This is a personal project, but it is fully open-source. Contributions, ideas, and feedback are always welcome! If you're interested in the architecture or want to help build a feature, feel free to dive into the code or open an issue.

# Project Minato

A high-performance torrent scraping and indexing suite with a Torznab-compatible API, dashboard, and pluggable Bun-based scrapers.

## 1. System Architecture

*   **Frontend**: Vite + React 19, TanStack Router, TanStack Query, Tailwind CSS v4, shadcn/ui components.
*   **API**: Hono/TypeScript running on Bun using @orpc for type-safe RPC endpoints. Handles torrent ingestion, Torznab XML feeds, user authentication (BetterAuth), and dashboard API.
*   **Workers**: BullMQ worker pipeline:
    *   **Ingest Worker**: Release parsing (release-parser), metadata extraction, Meilisearch indexing
    *   **Enrichment Worker**: TMDB + AniList metadata enrichment, media asset ingestion
    *   **Housekeeper Worker**: Maintenance tasks (reindex, cleanup, stale metadata refresh, stalled job recovery)
*   **Scrapers**: Bun-based scrapers using a shared SDK (`@project-minato/skit`), managed by a supervisor process. Currently ships with EZTV and Knaben scrapers.
*   **Databases**: 
    *   **PostgreSQL**: Source of truth (Torrents, Enrichments, User Accounts, API Keys, Blacklists, Scraper registry, Settings)
    *   **Meilisearch**: Full-text search engine with custom ranking profiles
    *   **Redis**: Message queue backend for BullMQ and pub/sub config updates
*   **Documentation**: Fumadocs-based documentation site


```text
[ EXTERNAL SOURCES ]          [ SCRAPERS ]               [ BACKEND API ]
      (The Web)            (Data Acquisition)         (Ingestion Layer)
--------------------        ------------------       -------------------
EZTV API             --->   EZTV Scraper ------->
                                                      POST /api/v1/rpc/torrents.ingest
Knaben ElasticSearch --->   Knaben Scraper ----->     (X-Minato-Key header)

Community scrapers   --->   Volume-mounted ----->     Scraper Supervisor
                            (config/scrapers/)        manages lifecycle
                                                     via SSE commands
                                                        v
+--------------------------------------------------------------+
|                    [ HONO API SERVER ]                       |
|                     (@orpc type-safe RPC)                    |
|                                                              |
|  1. Validate API key / scraper identity                      |
|  2. Schema validation (Zod)                                  |
|  3. Deduplication (by infoHash)                              |
|  4. Blacklist filtering (torrents & trackers)                |
|  5. PostgreSQL UPSERT with conflict resolution               |
|  6. Enqueue to BullMQ (ingest queue)                         |
+--------------------------------------------------------------+
                            |
                            v
                   [ REDIS / BullMQ ]
                    (Message Queue)
                            |
        +-------------------+-------------------+
        |                   |                   |
        v                   v                   v
+---------------+  +-------------------+  +-------------------+
| INGEST        |  | ENRICHMENT        |  | HOUSEKEEPER       |
| WORKER        |  | WORKER            |  | WORKER            |
|               |  |                   |  |                   |
| • Parse       |  | • TMDB provider   |  | • Sync/rebuild    |
|   release     |  | • AniList provider|  |   Meilisearch     |
|   titles      |  | • Ingest media    |  |   index           |
| • Extract     |  |   assets (poster/ |  | • Cleanup orphans |
|   metadata    |  |   backdrop)       |  |   & unused assets |
| • Update DB   |  | • Store in        |  | • Refresh stale   |
| • Buffer &    |  |   enrichments     |  |   metadata        |
|   batch index |  | • Update torrent  |  | • Recover stalled |
|   (500 docs   |  |   enrichedAt      |  |   jobs            |
|   or 5s       |  | • Reindex to      |  | • Purge           |
|   timeout)    |  |   Meilisearch     |  |   blacklisted     |
+---------------+  +-------------------+  +-------------------+
        |                   |                   |
        +-------------------+-------------------+
                            |
                            v
            +-------------------------------+
            |   [ MEILISEARCH INDEX ]       |
            |   Full-text searchable docs   |
            |   with enriched metadata      |
            |   3 ranking profiles          |
            +-------------------------------+
                            |
                            v
            [ DASHBOARD & API CONSUMERS ]
               • Web UI search & browse
               • Admin dashboard (stats, scrapers, users, settings)
               • Torznab API (Sonarr/Radarr)
               • RSS Feeds

```

### Key Architectural Decisions

**1. Worker Pipeline**
- **Ingest Worker**: Processes new torrents immediately after database insertion. Extracts metadata using release-parser, updates torrent records, batches documents for Meilisearch indexing (500 docs or 5s timeout).
- **Enrichment Worker**: Provider-based metadata enrichment. TMDB provider for movies/TV shows, AniList GraphQL provider for anime. Downloads and processes media assets (posters/backdrops) via sharp. Rate-limited external API calls with token bucket.
- **Housekeeper Worker**: Handles maintenance jobs — Meilisearch index sync/rebuild, orphan cleanup, stale metadata refresh, stalled job recovery, and blacklisted content purging.

**2. Data Model**
- **torrents** table: Core torrent metadata (infoHash as primary key), tracks multiple sources per torrent via jsonb array, uses `isDirty` flag for incremental updates.
- **enrichments** table: 1:1 relationship with torrents (cascade delete), stores TMDB/IMDb/AniList/MAL metadata, supports movies, TV shows, anime, music, and books.
- **blacklisted_torrents** / **blacklisted_trackers**: Filtering happens at ingestion time to prevent unwanted content.
- **scrapers** / **scraper_status** / **scraper_commands**: Scraper registry with runtime state and command queue for lifecycle management.
- **settings**: Key-value configuration store with Redis pub/sub for cross-process updates.

**3. Batch Indexing Strategy**
- Workers buffer documents (500 docs or 5s timeout for ingest, 50 docs or 30s timeout for enrichment) before bulk indexing to Meilisearch.
- On failure, items are returned to the buffer and retried.

**4. Type Safety Throughout**
- Zod schemas for runtime validation
- Drizzle ORM for database type safety
- @orpc for end-to-end type-safe RPC calls from frontend to backend (via @orpc/tanstack-query)
- Shared types across monorepo packages

### 1.a Stack

**Frontend:**
- **Build Tool**: Vite 6 with React 19.
- **Routing**: TanStack Router (file-based, type-safe, code-generated route tree).
- **Styling**: Tailwind CSS v4, `class-variance-authority`, dark/light theme support.
- **Components**: shadcn/ui, Radix UI primitives, Base UI, Lucide-React icons.
- **Data Fetching**: TanStack Query with @orpc/tanstack-query for end-to-end type-safe RPC.
- **Forms**: TanStack Form for type-safe form management.
- **Charts**: Recharts for statistics and activity charts.
- **PWA**: vite-plugin-pwa for offline support.

**Backend (API & Management):**
- **Runtime**: Bun (high-speed execution and native TypeScript support).
- **Framework**: Hono (lightweight HTTP framework).
- **RPC Layer**: @orpc (type-safe RPC with OpenAPI generation and Zod integration).
- **API Documentation**: @scalar/hono-api-reference for interactive API docs.
- **Authentication**: BetterAuth with email/password, passkeys (WebAuthn), API key generation, and admin role-based access control.
- **Database Layer**: Drizzle ORM (type-safe SQL builder for PostgreSQL) with checked-in migration files.
- **Validation**: Zod schemas throughout the application.

**Backend (Background Workers):**
- **Queue System**: BullMQ (Redis-backed distributed job queue).
- **Worker Pipeline**:
    - **Ingest Worker**: Release parsing (release-parser), metadata extraction, batch indexing to Meilisearch. Concurrency: 25.
    - **Enrichment Worker**: TMDB + AniList provider-based enrichment, media asset management, Meilisearch reindex. Concurrency: 75, lock duration: 60s.
    - **Housekeeper Worker**: Maintenance tasks (index sync, cleanup, refresh). Concurrency: 1.
- **Supervisor**: Manages scraper lifecycle — discovers scrapers, spawns Bun processes, handles scheduling, provides SSE command stream.

**Scrapers:**
- **SDK**: `@project-minato/skit` — shared framework for building scrapers with built-in ingest client, FlareSolverr integration, status reporting, and fetch helpers.
- **Built-in Scrapers**:
    - **EZTV**: Scheduled every 6 hours, paginates EZTV API.
    - **Knaben**: Scheduled daily at 3am, queries ElasticSearch across 228 categories with deduplication.
- **Community Scrapers**: Volume-mounted at `/config/scrapers/` for third-party scraper packages.
- **Communication**: Authenticated RPC calls to ingestion endpoint.

**Search & Persistence:**
- **Primary Database**: PostgreSQL (source of truth for all entities).
- **Search Engine**: Meilisearch with three configurable ranking profiles (quality, health, freshness), custom searchable/filterable/facet attributes, and inline search directives (`type:movie`, `res:1080p`, `!source`, IMDB/TMDB IDs).
- **Queue Backend**: Redis (BullMQ job persistence, config pub/sub).
- **Schema**: Drizzle ORM with type-safe, checked-in SQL migrations.

**Documentation:**
- **Framework**: Fumadocs (Next.js-based documentation framework).
- **Content**: MDX-based documentation with automatic navigation generation.

**DevOps & Tooling:**
- **Monorepo**: Turborepo (managing `apps/` and `packages/` workspaces).
- **Package Manager**: Bun with workspace protocol (`workspace:*`).
- **Code Quality**: Biome (linting and formatting, tabs, double quotes, sorted classes).
- **Type Safety**: TypeScript 5.x with strict mode.
- **Build Tools**: tsdown for server/worker compilation, Vite for frontend.
- **Task Runner**: Justfile for common operations.
- **Development**: Docker Compose for local infrastructure (PostgreSQL, Redis, Meilisearch, FlareSolverr).

---

## 2. Directory Structure (Monorepo)

```text
/
├── apps/
│   ├── web/                    # Vite + React 19 Frontend
│   │   ├── src/
│   │   │   ├── routes/         # TanStack Router (file-based)
│   │   │   ├── components/     # React components (shadcn/ui)
│   │   │   ├── hooks/          # Custom React hooks
│   │   │   └── lib/            # Client-side utilities
│   │   └── package.json
│   ├── server/                 # Hono API with @orpc (port 3000)
│   │   ├── src/
│   │   │   ├── api/            # RPC routers and contracts
│   │   │   │   ├── routers/    # torrentRouter, searchRouter, etc.
│   │   │   │   ├── contracts/  # @orpc contract definitions
│   │   │   │   └── context.ts  # Request context builder
│   │   │   ├── feeds/          # Torznab & RSS feed handlers
│   │   │   ├── lib/            # Search query parser, etc.
│   │   │   └── index.ts        # Server entry point
│   │   └── package.json
│   ├── jobs/                   # BullMQ Workers + Supervisor
│   │   ├── src/
│   │   │   ├── workers/
│   │   │   │   ├── ingest-worker.ts           # Release parsing & indexing
│   │   │   │   ├── enrichment-worker.ts       # TMDB + AniList enrichment
│   │   │   │   └── housekeeper-worker.ts      # Maintenance tasks
│   │   │   ├── supervisor/
│   │   │   │   ├── index.ts       # Scraper supervisor (lifecycle, scheduling)
│   │   │   │   └── commands.ts    # SSE command stream handler
│   │   │   ├── providers/         # Enrichment providers (TMDB, AniList)
│   │   │   ├── utils/             # Logger, media asset management
│   │   │   └── index.ts           # Worker orchestration
│   │   └── package.json
│   ├── scraper/                 # First-party scrapers
│   │   ├── eztv/                # EZTV scraper (scheduled, every 6h)
│   │   └── knaben/              # Knaben multi-category scraper (daily)
│   └── docs/                    # Fumadocs Documentation Site (port 4000)
│       ├── content/docs/        # MDX documentation files
│       ├── src/
│       └── package.json
├── packages/
│   ├── db/                      # Drizzle ORM & PostgreSQL
│   │   ├── src/
│   │   │   ├── schema/          # Database schemas
│   │   │   ├── migrations/      # Checked-in SQL migration files
│   │   │   ├── migrate.ts       # Migration runner
│   │   │   └── seed.ts          # Database seeding
│   │   └── drizzle.config.ts
│   ├── auth/                    # BetterAuth configuration
│   ├── queue/                   # BullMQ setup & queue definitions
│   ├── meilisearch/             # Meilisearch client, batcher, profiles, sync
│   ├── env/                     # t3-env validated environment variables
│   ├── utils/                   # Shared utilities (categories, etc.)
│   ├── api-clients/             # API clients (FlareSolverr, EZTV, Knaben)
│   ├── config/                  # Runtime config system (DB-backed with Redis pub/sub)
│   ├── skit/                    # Scraper SDK (define scrapers, ingest client, FlareSolverr)
│   └── typescript/              # Shared base tsconfig
├── config/                      # Runtime config storage (media/, scrapers/)
├── docker/                      # Production configs (nginx.conf, supervisord.conf)
├── patches/
│   └── release-parser@1.5.3.patch  # Custom patch for release-parser
├── docker-compose.dev.yaml      # Local development infrastructure
├── docker-compose.yaml          # Production stack
├── Dockerfile                   # Multi-stage production image (nginx + supervisord + Bun)
├── turbo.json                   # Turborepo pipeline configuration
├── biome.json                   # Biome linter/formatter config
├── Justfile                     # Task runner
├── package.json                 # Root workspace configuration
└── README.md                    # This file
```

---

## 3. Security Model

| Traffic Type | Auth Method | Permission |
| :--- | :--- | :--- |
| **User -> Web UI (Admin)** | BetterAuth (session-based) | Full Admin access |
| **User -> Web UI** | BetterAuth (session-based) | Authenticated access |
| **Sonarr/Radarr -> API** | `?apikey=` query param | Read-only Torznab |
| **Scrapers -> API** | `X-Minato-Key` header | Write-only ingestion |
| **Internal Services -> DB** | Internal Docker Network / localhost | Full access |
| **Workers -> Queue** | Redis connection | Job processing |
| **Scraper Supervisor -> Scrapers** | SSE command stream + key provisioning | Process management |

**Current Status**: 
- BetterAuth with email/password, passkeys, and admin role-based access control
- API key system with `mk_` prefix for scraper authentication and Torznab access
- Scraper supervisor with automated key provisioning and health monitoring

---

## 4. Features

Refer to the [project roadmap](ROADMAP.md) for comprehensive implementation status.

### Implemented ∞

- **Core Infrastructure**:
  - Worker pipeline (Ingest, Enrichment, Housekeeper)
  - PostgreSQL database with Drizzle ORM and checked-in migrations
  - Meilisearch full-text search with 3 ranking profiles
  - Redis/BullMQ job queue system with config pub/sub
  - Type-safe RPC APIs with @orpc + OpenAPI generation

- **Torrent Management**:
  - Bulk ingestion API via type-safe RPC
  - Automatic deduplication by infoHash
  - Blacklist system (torrents and trackers)
  - Release parsing for metadata extraction (release-parser)
  - Multi-source tracking (jsonb array with conflict merging)

- **Metadata Enrichment**:
  - TMDB API integration for movies and TV shows
  - AniList GraphQL integration for anime
  - Media asset management with image processing (sharp)
  - Rate-limited external API calls (token bucket)

- **Search & Indexing**:
  - Batch indexing to Meilisearch
  - Flattened enrichment data for search
  - Inline search directives (`type:movie`, `res:1080p`, `!source`, IMDB/TMDB IDs)
  - Full database reindexing capability
  - `isDirty` tracking for incremental updates

- **Scrapers**:
  - Scraper SDK (`@project-minato/skit`) with ingest client and FlareSolverr support
  - EZTV scraper (scheduled, every 6 hours)
  - Knaben scraper (daily, 228 categories, deduplication)
  - Supervisor process for lifecycle management (spawn, schedule, health check)
  - SSE-based command stream (pause/stop/resume)
  - Support for community scrapers via volume-mounted `/config/scrapers/`

- **Dashboard (Web UI)**:
  - Home page with instant search and inline filters
  - Torrent detail view
  - Admin dashboard with stats overview, ingest activity chart
  - Scraper management (list, enable/disable, view status)
  - User management (list, role changes, ban)
  - API key management (create, revoke)
  - Settings management (app configuration)
  - Dark/light theme support, responsive design

- **Authentication & API**:
  - BetterAuth with email/password and passkey (WebAuthn) support
  - API key system for scrapers and Torznab consumers
  - Torznab XML feed endpoint
  - RSS feed endpoint
  - First-run setup wizard

- **Deployment**:
  - Multi-stage Docker image (nginx + supervisord + Bun)
  - Single unified port (7271) via nginx reverse proxy
  - Production docker-compose with PostgreSQL, Redis, Meilisearch
  - Multi-arch builds (linux/amd64, linux/arm64)
  - Auto-migration on boot

- **Developer Experience**:
  - Turborepo monorepo with workspace dependencies
  - Biome for code formatting and linting
  - Type-safe schemas with Zod + Drizzle + @orpc
  - Hot module reloading in development
  - Health check endpoints
  - Structured logging with Pino
  - Fumadocs documentation site

### Planned Features 🚧

- **Scrapers & Data Acquisition**:
  - Additional first-party scrapers (1337x, TPB, DHT crawler)
  - Configurable base URLs with proxy support
  - Bulk import tools for external databases (RARBG dumps, etc.)

- **Advanced Features**:
  - Export functionality for portable SQLite databases
  - Webhook and notification system
  - Prometheus metrics endpoints for Grafana integration
  - SSO authentication options

---

## 5. Deployment

### Current Development Setup

For local development, the project uses Docker Compose for infrastructure:

```bash
# Start infrastructure (PostgreSQL, Redis, Meilisearch, FlareSolverr)
bun run infra:up

# Run all development servers
bun dev
```

**docker-compose.dev.yaml** includes:
- PostgreSQL (port 5432)
- Redis (port 6379)
- Meilisearch (port 7700)
- FlareSolverr (port 8191)

### Production Deployment

Production uses a single Docker image with all components managed by supervisord:

```bash
# Build and start the full stack
docker compose up -d

# Or pull the pre-built image
docker pull gergogyulai/minato:latest
```

**Production image includes**:
- Vite static frontend assets served by nginx
- Hono API server (Bun)
- BullMQ workers (Bun)
- Scraper supervisor (Bun)
- Nginx reverse proxy (consolidating services on port 7271)
- Supervisord for process management
- Auto-migration on first boot

**Architecture**:
- Nginx serves static frontend assets at `/` with SPA fallback
- API requests (`/api/*`) proxied to Bun backend on port 3000
- Media assets (`/assets/*`) proxied to backend with disk fallback
- Persistent config at `/config` volume (media, community scrapers)

---

## 6. Development Workflow

### Prerequisites
- **Bun** v1.3.0+ (package manager and runtime)
- **Docker** and **Docker Compose** (for infrastructure)
- **Just** (optional, for task runner commands)

### Getting Started

1. **Clone the repository**:
   ```bash
   git clone https://github.com/gergogyulai/minato.git
   cd minato
   ```

2. **Install dependencies**:
   ```bash
   bun install
   ```

3. **Start infrastructure**:
   ```bash
   bun run infra:up
   ```
   This starts PostgreSQL, Redis, Meilisearch, and FlareSolverr via Docker Compose.

4. **Set up environment variables**:
   - Copy `.env.example` to `.env`
   - Configure database URLs, TMDB API key, etc.

5. **Run database migrations**:
   ```bash
   bun db:migrate
   ```

6. **Start development servers**:
   ```bash
   # All services (recommended for full-stack development)
   bun dev

   # Or individually:
   bun dev:web      # Frontend (Vite dev server)
   bun dev:server   # API at http://localhost:3000
   bun dev:jobs     # Workers
   bun dev:docs     # Docs at http://localhost:4000
   bun dev:scrapers # Scrapers
   ```

### Useful Commands

```bash
# Database
bun db:studio         # Open Drizzle Studio
bun db:push           # Push schema changes directly
bun db:generate       # Generate migration files
bun db:migrate        # Run pending migrations

# Code Quality
bun check             # Run Biome linter/formatter
bun check-types       # Type check all packages

# Build
bun build             # Build all packages for production

# Docker
bun docker:build      # Build production Docker image
bun nuke              # Remove all dependencies and reinstall
```

### Project Structure Tips

- **Shared packages**: Packages in `/packages` are shared across all apps
- **Workspace protocol**: Use `workspace:*` for internal dependencies
- **Type safety**: End-to-end type safety from Zod schemas through @orpc contracts to TanStack Query hooks
- **Hot reload**: All apps support hot module reloading in dev mode
- **Migrations**: Checked into git and run automatically on boot — the source of truth for the database schema