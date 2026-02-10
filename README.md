> [!CAUTION]
> This project is currently in **active development**. Core infrastructure is functional, but user-facing features (dashboard UI, Torznab API, Go scrapers) are still being implemented. The codebase is operational for development and testing purposes.

> [!NOTE]
> **Open Source & Contributions**: This is a personal project, but it is fully open-source. Contributions, ideas, and feedback are always welcome! If you're interested in the architecture or want to help build a feature, feel free to dive into the code or open an issue.

# Project Blueprint: "Project Minato"

A high-performance torrent scraping and indexing suite with a Torznab-compatible API, Next.js dashboard, and Go-based public tracker scrapers (The Pirate Bay, 1337x, knaben.org) and DHT crawlers.

## 1. System Architecture

*   **Frontend**: Next.js 16 (App Router), Tailwind CSS, Lucide-React, shadcn components.
*   **API**: Hono/TypeScript running on Bun using @orpc for type-safe RPC endpoints. Handles torrent ingestion, Torznab XML feeds, user authentication (BetterAuth), and dashboard API.
*   **Workers**: Three-phase BullMQ worker pipeline:
    *   **Ingest Worker**: Release parsing (release-parser), initial metadata extraction, Meilisearch indexing
    *   **Enrichment Worker**: TMDB metadata enrichment, media asset ingestion
    *   **Reindex Worker**: Full database reindexing capabilities
*   **Scrapers**: Currently TypeScript/Bun-based importers. Go-based DHT crawlers and site-specific scrapers planned.
*   **Databases**: 
    *   **PostgreSQL**: Source of truth (Torrents, Enrichment data, User Accounts, API Keys, Blacklists)
    *   **Meilisearch**: Full-text search engine with document indexing
    *   **Redis**: Message queue backend for BullMQ
*   **Documentation**: Fumadocs-based documentation site


```text
[ EXTERNAL SOURCES ]          [ SCRAPERS / IMPORTERS ]    [ BACKEND API ]
      (The Web)               (Data Acquisition)         (Ingestion Layer)
--------------------        ---------------------       -------------------
Database Dumps        --->                              
(SQLite/CSV/JSON)           TypeScript Importers  ---->
                            (knaben.ts, etc.)           POST /api/v1/torrents/ingest
RSS Feeds             --->                              (X-Minato-Scraper: scraper_id)
Planned:                    Go-based Scrapers     ---->
- 1337x Crawler              (Future)                   |
- TPB Crawler                                           |
- DHT Crawler                                           |
                                                        v
+---------------------------------------------------------------+
|                    [ HONO API SERVER ]                        |
|                     (@orpc type-safe RPC)                     |
|                                                               |
|  1. Validate X-Minato-Scraper header                          |
|  2. Schema validation (Zod)                                   |
|  3. Deduplication (by infoHash)                               |
|  4. Blacklist filtering (torrents & trackers)                 |
|  5. PostgreSQL UPSERT with conflict resolution                |
|  6. Enqueue to BullMQ (ingest queue)                          |
+---------------------------------------------------------------+
                            |
                            v
                  [ REDIS / BullMQ ]
                   (Message Queue)
                            |
        +-------------------+-------------------+
        |                   |                   |
        v                   v                   v
+---------------+  +-------------------+  +---------------+
| INGEST        |  | ENRICHMENT        |  | REINDEX       |
| WORKER        |  | WORKER            |  | WORKER        |
|               |  |                   |  |               |
| • Parse       |  | • Query TMDB API  |  | • Full DB     |
|   release     |  | • Match metadata  |  |   rescan      |
|   titles      |  | • Ingest media    |  | • Rebuild     |
| • Extract     |  |   assets (poster/ |  |   Meilisearch |
|   metadata    |  |   backdrop)       |  |   index       |
| • Update DB   |  | • Store in        |  |               |
| • Buffer &    |  |   enrichments     |  |               |
|   batch index |  |   table           |  |               |
|   (50 docs or |  | • Update torrent  |  |               |
|   3s timeout) |  |   enrichedAt      |  |               |
|               |  | • Reindex to      |  |               |
|               |  |   Meilisearch     |  |               |
+---------------+  +-------------------+  +---------------+
        |                   |                   |
        +-------------------+-------------------+
                            |
                            v
            +-------------------------------+
            |   [ MEILISEARCH INDEX ]       |
            |   Full-text searchable docs   |
            |   with enriched metadata      |
            +-------------------------------+
                            |
                            v
            [ NEXT.JS DASHBOARD & API CONSUMERS ]
               • Web UI search & browse
               • Torznab API (Sonarr/Radarr)
               • RSS Feeds

```

### Key Architectural Decisions

**1. Three-Phase Worker Pipeline**
- **Ingest Worker**: Processes new torrents immediately after database insertion. Extracts metadata using release-parser, updates torrent records, batches documents for Meilisearch indexing.
- **Enrichment Worker**: Runs after ingestion. Queries TMDB API for movies/TV shows, downloads media assets (posters/backdrops), stores enrichment data in separate table with 1:1 relationship.
- **Reindex Worker**: Handles full database reindexing on-demand, useful for schema changes or search configuration updates.

**2. Data Model**
- **torrents** table: Core torrent metadata (infoHash as primary key), tracks multiple sources per torrent, uses `isDirty` flag for incremental updates.
- **enrichments** table: 1:1 relationship with torrents (cascade delete), stores TMDB/IMDb metadata, supports movies, TV shows, and planned support for anime, music, books.
- **blacklisted_torrents** / **blacklisted_trackers**: Filtering happens at ingestion time to prevent unwanted content.

**3. Batch Indexing Strategy**
- Workers buffer documents (up to 50 or 3-second timeout) before bulk indexing to Meilisearch
- Reduces API calls and improves throughput
- Graceful error handling to prevent data loss

**4. Type Safety Throughout**
- Zod schemas for runtime validation
- Drizzle ORM for database type safety
- @orpc for end-to-end type-safe RPC calls from frontend to backend
- Shared types across monorepo packages

### 1.a Stack

**Frontend:**
- **Framework**: Next.js 16 using the App Router.
- **Styling**: Tailwind CSS v4 for a modern, responsive dashboard.
- **Components**: shadcn/ui components with Radix UI primitives, Base UI.
- **Icons**: Lucide-React.
- **Data Fetching**: TanStack Query (@tanstack/react-query) for efficient client-side caching.
- **Forms**: TanStack Form for type-safe form management.

**Backend (API & Management):**
- **Runtime**: Bun (high-speed execution and native TypeScript support).
- **Framework**: Hono (lightweight HTTP framework).
- **RPC Layer**: @orpc (type-safe RPC with OpenAPI generation and Zod integration).
- **API Documentation**: @scalar/hono-api-reference for interactive API docs.
- **Authentication**: BetterAuth (modern authentication with SSO support and session management).
- **Database Layer**: Drizzle ORM (type-safe SQL builder for PostgreSQL).
- **Validation**: Zod schemas throughout the application.

**Backend (Background Workers):**
- **Queue System**: BullMQ (Redis-backed distributed job queue).
- **Worker Pipeline**: Three-phase processing:
    - **Ingest Worker**: Release parsing (release-parser), metadata extraction, batch indexing to Meilisearch.
    - **Enrichment Worker**: TMDB API integration for metadata enrichment, media asset management.
    - **Reindex Worker**: Full database reindexing capabilities.
- **Key Features**:
    - Batch processing (50 documents or 3-second timeout)
    - Rate limiting for external APIs (TMDB)
    - Graceful shutdown handling
    - Connection health checks

**Scrapers & Importers:**
- **Current**: TypeScript/Bun-based database importers (e.g. for SQLite dump ingestion).
- **Planned**: Go-based scrapers using `anacrolix/torrent` for:
    - DHT crawling
    - Site-specific scraping (1337x, TPB, etc.)
    - RSS feed polling
- **Communication**: HTTP POST to `/api/v1/torrents/ingest` with `X-Minato-Scraper` header.

**Search & Persistence:**
- **Primary Database**: PostgreSQL (source of truth for torrents, enrichments, blacklists, users, API keys).
- **Search Engine**: Meilisearch (full-text search with custom ranking rules, typo tolerance).
- **Queue Backend**: Redis (BullMQ job persistence and coordination).
- **Schema**: Drizzle ORM with type-safe migrations.

**Documentation:**
- **Framework**: Fumadocs (Next.js-based documentation framework).
- **Content**: MDX-based documentation with automatic navigation generation.

**DevOps & Tooling:**
- **Monorepo**: Turborepo (managing `apps/` and `packages/` workspaces).
- **Package Manager**: Bun with workspace support.
- **Code Quality**: Biome (linting and formatting).
- **Type Safety**: TypeScript 5.x with strict mode.
- **Build Tools**: 
    - tsdown for server compilation
    - Next.js built-in bundling for frontend
- **Development**: Docker Compose for local infrastructure (PostgreSQL, Redis, Meilisearch).

---

## 2. Directory Structure (Monorepo)

```text
/
├── apps/
│   ├── web/                # Next.js 16 Frontend (port 3001)
│   │   ├── src/
│   │   │   ├── app/        # Next.js App Router pages
│   │   │   ├── components/ # React components (shadcn/ui)
│   │   │   ├── hooks/      # Custom React hooks
│   │   │   └── lib/        # Client-side utilities
│   │   └── package.json
│   ├── server/             # Hono API with @orpc (port 3000)
│   │   ├── src/
│   │   │   ├── api/        # RPC routers and contracts
│   │   │   │   ├── routers/    # torrentRouter, blacklistRouter
│   │   │   │   ├── contracts/  # @orpc contract definitions
│   │   │   │   └── context.ts  # Request context builder
│   │   │   ├── feeds/      # Torznab & RSS feed handlers
│   │   │   ├── schemas/    # Zod validation schemas
│   │   │   └── index.ts    # Server entry point
│   │   └── package.json
│   ├── jobs/               # BullMQ Background Workers
│   │   ├── src/
│   │   │   ├── workers/
│   │   │   │   ├── ingest-worker.ts      # Release parsing & indexing
│   │   │   │   ├── enrichment-worker.ts  # TMDB metadata enrichment
│   │   │   │   └── reindex-worker.ts     # Full DB reindexing
│   │   │   ├── utils/
│   │   │   │   ├── logger.ts   # Structured logging
│   │   │   │   └── media.ts    # Asset management
│   │   │   ├── rate-limiter.ts # TMDB API rate limiting
│   │   │   └── index.ts        # Worker orchestration
│   │   └── package.json
│   └── docs/               # Fumadocs Documentation Site (port 4000)
│       ├── content/docs/   # MDX documentation files
│       ├── src/
│       └── package.json
├── packages/
│   ├── db/                 # Drizzle ORM & PostgreSQL
│   │   ├── src/
│   │   │   ├── schema/     # Database schemas (torrents, enrichments, etc.)
│   │   │   ├── migrations/ # SQL migrations
│   │   │   └── index.ts
│   │   ├── drizzle.config.ts
│   │   └── seed.ts         # Database seeding
│   ├── auth/               # BetterAuth configuration
│   ├── queue/              # BullMQ setup & queue definitions
│   ├── meilisearch/        # Meilisearch client & helpers
│   ├── env/                # Environment variable validation
│   ├── utils/              # Shared utilities
│   └── config/             # Shared tsconfig & Biome config
├── patches/
│   └── release-parser@1.5.3.patch  # Custom patch for release-parser
├── docker-compose.dev.yaml # Local development infrastructure
├── Dockerfile              # (Planned) Production container
├── turbo.json              # Turborepo pipeline configuration
├── biome.json              # Biome linter/formatter config
├── package.json            # Root workspace configuration
└── README.md               # This file
```

**Note**: Go-based scrapers (`services/` directory) are planned but not yet implemented. Current data ingestion uses TypeScript/Bun scripts.

---

## 3. Security Model

| Traffic Type | Auth Method | Permission |
| :--- | :--- | :--- |
| **User -> Web UI** | BetterAuth (session-based) | Full Admin access |
| **Sonarr/Radarr -> API** | `?apikey=` (User Generated) | Read-only Torznab (planned) |
| **Scrapers -> API** | `X-Minato-Scraper` (header-based identification) | Write-only `/api/v1/torrents/ingest` |
| **Internal Services -> DB** | Internal Docker Network / localhost | Full access |
| **Workers -> Queue** | Redis connection | Job processing |

**Current Status**: 
- BetterAuth is configured for dashboard authentication
- Scraper identification uses `X-Minato-Scraper` header
- API key system for Torznab is planned but not yet implemented
- All services communicate via localhost in development

---

## 4. Features

### Implemented ✅

- **Core Infrastructure**:
  - Three-phase worker pipeline (Ingest, Enrichment, Reindex)
  - PostgreSQL database with Drizzle ORM
  - Meilisearch full-text search integration
  - Redis/BullMQ job queue system
  - Type-safe RPC APIs with @orpc

- **Torrent Management**:
  - Bulk ingestion API at `/api/v1/torrents/ingest`
  - Automatic deduplication by infoHash
  - Blacklist system (torrents and trackers)
  - Release parsing for metadata extraction (release-parser)
  - Source tracking (multiple sources per torrent)

- **Metadata Enrichment**:
  - TMDB API integration for movies and TV shows
  - Media asset management (posters, backdrops)
  - Genre, runtime, ratings, and overview extraction
  - Rate-limited external API calls

- **Search & Indexing**:
  - Batch indexing to Meilisearch (50 docs or 3s timeout)
  - Flattened enrichment data for search
  - Full database reindexing capability
  - isDirty tracking for incremental updates

- **Developer Experience**:
  - Turborepo monorepo with workspace dependencies
  - Biome for code formatting and linting
  - Type-safe schemas with Zod + Drizzle
  - Hot module reloading in development
  - Health check endpoints with pretty printing
  - Structured logging with colored output
  - Fumadocs documentation site

### Planned Features 🚧

- **User Interface**:
  - Dashboard for managing torrents from all sources
  - Browse and search interface for end users
  - Statistics and analytics views

- **Authentication & API**:
  - User-generated API keys for Torznab access
  - Torznab-compatible API for Sonarr/Radarr integration
  - SSO authentication options

- **Scrapers & Data Acquisition**:
  - DHT crawler (initially powered by bitmagnet, standalone version planned)
  - Go-based site-specific scrapers (TPB, 1337x, EZTV, Knaben)
  - Configurable base URLs for crawled sites (+proxy support)
  - Extensible RSS feed crawling
  - Bulk import tools for external databases (RARBG dumps, etc.)

- **Advanced Features**:
  - Self-hosted private tracker with view-only user access
  - Export functionality for portable SQLite databases
  - FlareSolverr integration for Cloudflare-protected sites
  - Webhook and notification system
  - Prometheus metrics endpoints for Grafana integration

- **Deployment**:
  - Single unified Docker image with nginx proxy
  - Supervisord process management
  - Production-ready configuration examples
---

## 5. Deployment

### Current Development Setup

For local development, the project uses Docker Compose for infrastructure:

```bash
# Start infrastructure (PostgreSQL, Redis, Meilisearch)
bun run infra:up

# Run all development servers
bun dev

# Or run individual apps
bun dev:web      # Next.js frontend (port 3001)
bun dev:server   # Hono API (port 3000)
cd apps/jobs && bun dev  # Workers
```

**docker-compose.dev.yaml** includes:
- PostgreSQL (port 5432)
- Redis (port 6379)
- Meilisearch (port 7700)

### Planned Production Deployment

Production deployment will use a single Docker image with all components:

```yaml
version: '3.8'

services:
  minato:
    image: gergogyulai/minato:latest
    environment:
      - DATABASE_URL=postgresql://user:${DB_PASSWORD}@postgres:5432/minato
      - MEILISEARCH_HOST=http://meilisearch:7700
      - REDIS_URL=redis://redis:6379
    ports:
      - "7271:7271"  # Unified port (nginx proxy)
    volumes:
      - ./data:/app/data  # Media assets
    networks:
      - web-public
      - minato-internal
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.minato.rule=Host(`${DOMAIN}`)"
      - "traefik.http.services.minato.loadbalancer.server.port=7271"

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: minato
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - pg_data:/var/lib/postgresql/data
    networks:
      - minato-internal

  redis:
    image: redis:alpine
    command: redis-server --save 60 1 --loglevel warning
    volumes:
      - redis_data:/data
    networks:
      - minato-internal

  meilisearch:
    image: getmeili/meilisearch:v1.6
    environment:
      - MEILI_MASTER_KEY=${MEILI_MASTER_KEY}
      - MEILI_NO_ANALYTICS=true
    volumes:
      - meili_data:/meili_data
    networks:
      - minato-internal

networks:
  web-public:
    external: true
  minato-internal:

volumes:
  pg_data:
  redis_data:
  meili_data:
```

**Production image will include**:
- Next.js frontend (static export or standalone server)
- Hono API server
- BullMQ workers
- Nginx reverse proxy (consolidating services on port 7271)
- Supervisord for process management
- Go-based scrapers (when implemented)

---

## 6. Development Workflow

### Prerequisites
- **Bun** v1.3.0+ (package manager and runtime)
- **Docker** and **Docker Compose** (for infrastructure)
- **Node.js** 20+ (for compatibility)

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
   This starts PostgreSQL, Redis, and Meilisearch via Docker Compose.

4. **Set up environment variables**:
   - Copy `.env.example` to `.env` (if provided)
   - Configure database URLs, API keys, etc.

5. **Run database migrations**:
   ```bash
   bun db:push     # Push schema changes
   bun db:generate # Generate migrations
   bun db:migrate  # Run migrations
   ```

6. **Start development servers**:
   ```bash
   # All services (recommended for full-stack development)
   bun dev

   # Or individually:
   bun dev:web      # Frontend at http://localhost:3001
   bun dev:server   # API at http://localhost:3000
   cd apps/jobs && bun dev  # Workers
   cd apps/docs && bun dev  # Docs at http://localhost:4000
   ```

### Useful Commands

```bash
# Database
bun db:studio         # Open Drizzle Studio
bun db:push           # Push schema changes
bun db:generate       # Generate migrations

# Code Quality
bun check             # Run Biome linter/formatter
bun check-types       # Type check all packages

# Build
bun build             # Build all packages for production

# Clean slate
bun nuke              # Remove all dependencies and reinstall
```

### Project Structure Tips

- **Shared packages**: Packages in `/packages` are shared across all apps
- **Workspace protocol**: Use `workspace:*` for internal dependencies
- **Type safety**: All schemas use Zod, database uses Drizzle for type safety
- **Hot reload**: All apps support hot module reloading in dev mode