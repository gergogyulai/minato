# Project Minato - Development Roadmap

## Milestones

### Milestone 1: Data Architecture & Monorepo Plumbing

Focus on the "source of truth" and how data flows between TypeScript and Go.
- [X] **Monorepo Structure**
    - [x] Setup Turborepo with `apps/web`, `apps/server`, `apps/jobs`, `apps/docs`, and `packages/*`.
    - [ ] Initialize `go.work` to manage multiple Go scraper modules. (Deferred - using TypeScript importers currently)
- [X] **Drizzle Schema Definition**
    - [x] `torrents` table with comprehensive metadata fields
    - [x] `enrichments` table with 1:1 relationship
    - [x] `blacklisted_torrents` and `blacklisted_trackers` tables
    - [x] Proper indexes (GIN, partial, standard)
- [X] **Meilisearch**
    - [x] Create torrents index with proper configuration
    - [x] Configure ranking rules to prioritize health (seeders) and recency
    - [x] Document flattening for enrichment data
    - [x] Setup script in `@project-minato/meilisearch` package

### Milestone 2: Scraper Infrastructure ⏳

> **Current Status**: This milestone is on hold. Currently using TypeScript/Bun-based importers (e.g., `knaben.ts`) for bulk data ingestion. Go-based scrapers will be implemented after core platform features are stable.

**Alternative Approach - TypeScript Importers**:
- ✅ Direct HTTP POST to `/api/v1/torrents/ingest` with `X-Minato-Scraper` header
- ✅ Flexible schema allowing any scraper implementation (Python, Go, Bash, etc.)

**Future Go-based Implementation** (when needed):


#### 2.0 Networking and Plumbing
- [ ] **Multi-Protocol Proxy Rotator**:
    - Implement a `ProxyManager` that accepts a list of SOCKS5 and HTTP(S) proxies.
    - Support **IP Rotation Strategies**: "Round Robin" or "Sticky Session" (keep the same IP for a specific site crawl to avoid session flags).
- [ ] **Mirror/Base-URL Resolver**:
    - Create a "Mirror Health Check" that pings configured mirrors (e.g., the 1337x list) and selects the fastest/active one.

#### 2.1 Provider Implementations
- [ ] **HTML Scrapers (The Crawler)**:
    - **1337x, TPB, etc.**: Implement using `gocolly/colly`. Support deep crawling (extracting file lists and descriptions from torrent detail pages).
- [ ] **API Scrapers (The Grabbers)**:
    - **EZTV, YTS, Knaben, etc.**: Implement specialized clients for sites with JSON endpoints to minimize CPU/Bandwidth usage.
- [ ] **Universal RSS Poller**:
    - Build a worker that consumes any standard Torznab/RSS feed. 
    - Store `last_seen_guid` in the database to prevent duplicate ingestion processing.
- [ ] **DHT Scraper**:
    - [ ] **DHT Scraper Phase 1 (The Bridge)**:
        - Build a connector that pulls data from a running **Bitmagnet** instance into Minato.
    - [ ] **DHT Scraper Phase 2 (Native)**:
        - Build a standalone Go worker using `anacrolix/dht`. 
        - Once an info-hash is found, connect to peers to resolve the file list and sizes.  
- [ ] **The "Scraper-Core" Package**
    - [ ] Implement a circuit breaker to pause scraping if the TS API returns 5xx errors.
- [ ] **Provider Implementation**
    - [ ] **1337x/Knaben Scrapers**: Use `gocolly/colly` to parse HTML. Implement logic to follow "Next Page" up to a configurable depth.
    - [ ] **DHT Crawler**: Implement a metadata wire protocol to fetch `metadata` (filenames/sizes) once an info-hash is found via DHT.
- [ ] **Site Proxy Support**
    - [ ] Build a configuration loader that reads a list of mirrors for each site.

#### 2.2 Multi-Language SDKs (Convenience)
- [ ] **Go SDK (`minato-go`)**:
    - **Smart Transport**: A `net/http` wrapper that handles proxy rotation and mirror switching automatically.
    - **Submission Buffer**: Logic to batch torrents and send them in chunks to reduce API overhead.
- [ ] **TypeScript SDK (`@minato/sdk`)**:
    - **Validation Layer**: Zod-based checks to ensure data matches the API spec before sending.
    - **Environment Aware**: Native support for Bun and Node environments.

### Milestone 3: The API & Workers 🔄

> **Current Status**: Core ingestion and worker pipeline implemented. Torznab and advanced features in progress.

- [x] **Ingestion Pipeline**
    - [x] Create a `/api/v1/torrents/ingest` POST endpoint (supports both single and bulk ingestion)
    - [ ] Create `.torrent` file ingestion `/api/ingest/file` POST endpoint to ingest torrent files into the database
    - [x] **Upsert Logic**: Conflict resolution on infoHash with source array merging
    - [ ] Skip reprocessing unchanged torrents to reduce unnecessary DB and Meilisearch writes
    - [x] **Sync to Meilisearch**: Three-phase worker pipeline (Ingest → Enrichment → Reindex)
        - [x] Ingest Worker: Release parsing, metadata extraction, batch indexing
        - [x] Enrichment Worker: TMDB integration, media asset management  
        - [x] Reindex Worker: Full database reindexing capability
- [ ] **Torznab XML Engine**
    - [Api spec docs](https://torznab.github.io/spec-1.3-draft/torznab/index.html)
    - [x] Basic XML feed structure implemented
    - [ ] Implement the `caps` (Capabilities) endpoint so Sonarr/Radarr can "see" supported categories
    - [ ] Implement the `search` function mapping Torznab query params to Meilisearch queries
    - [ ] Standard category mapping (2000=Movies, 5000=TV, etc.)
- [x] **BetterAuth Integration**
    - [x] Session-based authentication configured
    - [ ] Protect all routes with session or API key checks
    - [x] `X-Minato-Scraper` header for scraper-to-API identification
- [x] **The Classifier**
    - [x] Parse torrent titles using `release-parser`
    - [x] Extract Year, Resolution (1080p/4k), Codec (x264/h265), group, etc.
    - [ ] Natural language processing for titles to handle weird formatting not parsable using regex
- [x] **Metadata Enrichment** (Partial)
    - [x] Integrate with TMDB API to link torrents to movie/show metadata
    - [x] Download and manage media assets (posters, backdrops)
    - [x] Store enrichment data in dedicated table
    - [ ] Integrate with music metadata provider (MusicBrainz/Spotify)
    - [x] Integrate with AniList for anime content
- [ ] **Mirror Health Worker**
    - A background task that pings configured mirror lists for each site and flags which ones are currently online

### Milestone 4: The Next.js Dashboard 

> **Current Status**: UI framework in place (Next.js 16, shadcn/ui, TanStack Query), but features not yet implemented.

A modern UI to visualize the massive amount of data being indexed.
- [ ] **Search Interface**
    - [x] Build a high-performance search bar using TanStack Query
    - [x] Implement "Instant Search" as the user types, hitting the Meilisearch endpoint
    - [x] Advanced filters (resolution, codec, year, genre, etc.)
    - [ ] Result pagination and sorting
- [ ] **Torrent Details View**
    - [x] Display enriched metadata (poster, overview, ratings)
    - [ ] Show file lists and sizes
    - [ ] Display source tracking (which scrapers found this torrent)
    - [ ] Magnet link and download options
- [ ] **Real-time Monitoring**
    - [ ] Create a dashboard widget showing "Torrents Indexed per Minute"
    - [ ] Add a "Worker Status" page showing BullMQ job queue status
    - [ ] Display Meilisearch and database health metrics
- [ ] **Management Tools**
    - [x] API structure exists (see API Implementation table below)
    - [ ] Build the API Key generator UI
    - [ ] Implement a "Manual Re-index" button that triggers reindex worker
    - [ ] Blacklist management interface
    - [ ] Bulk operations (delete, re-enrich, etc.)


### API Implementation

> **Implementation Note**: Using @orpc for type-safe RPC with automatic OpenAPI generation. All endpoints available at `/api/v1/*` with interactive docs at `/api/reference`.

| Domain | Procedure Name | Access | Description | Status |
| :--- | :--- | :--- | :--- | :---: |
| **Torrents** | `torrents.ingest` | Scraper / Internal | Bulk/Single upsert to SQL + Trigger BullMQ Sync. | ✓ |
| | `torrents.update` | Admin | Manually edit raw torrent fields (Title, Category, etc). | ✓ |
| | `torrents.get` | User / API Key | Get InfoHash details with joined Enrichment data. | 🚧 (needs proper types)|
| | `torrents.delete` | Admin | Delete from SQL/Search (Cascades to Enrichment). | ✓ |
| | `torrents.enrichment.redo` | Admin | Requeue for enrichment. | ⏳ |
| | `torrents.enrichment.update` | Admin | Manually edit enrichment data | ⏳ |
| | `torrents.enrichment.link` | Admin | Manual override and bind to a specific TMDB/IMDb ID. | ⏳ |
| **Search** | `search.torrents` | User / Admin | Full-text query against Meilisearch with filters. | ✓ |
| **Metadata** | `metadata.search.tmdb` | Admin | Direct proxy to TMDB search. | ⏳ |
| **Blacklist** | `blacklist.torrent.add` | Admin | Block an infoHash and remove existing records. | ✓ |
| | `blacklist.torrent.remove` | Admin | Unblock an infoHash. | ✓ |
| | `blacklist.torrent.list` | Admin | List all blocked hashes. | ✓ |
| | `blacklist.tracker.add` | Admin | Block a tracker URL/pattern. | ✓ |
| | `blacklist.tracker.remove` | Admin | Unblock a tracker. | ✓ |
| | `blacklist.tracker.list` | Admin | List all blocked trackers. | ✓ |
| **Feeds** | `feeds.torznab` | User / API Key | Torznab-compatible XML feed. | 🚧 |
| | `feeds.rss` | User / API Key | Standard RSS feed. | 🚧 |
| **Admin** | `admin.stats` | Admin | DB Row counts, Index Health, Worker Latency. | ⏳ |
| | `admin.config.get` | Admin | Read Scraper/Mirror/FlareSolverr settings. | ⏳ |
| | `admin.config.update` | Admin | Update site URLs or Env vars live. | ⏳ |
| | `admin.apiKeys.list` | Admin | View all Torznab/Dashboard keys. | ⏳ |
| | `admin.apiKeys.create` | Admin | Issue a new API Key. | ⏳ |
| | `admin.apiKeys.revoke` | Admin | Instantly invalidate a key. | ⏳ |
| **System** | `sys.jobs.list` | Admin | Monitor BullMQ (Sync/Enrichment status). | ⏳ |
| | `sys.jobs.retry` | Admin | Manually push failed jobs back to queue. | ⏳ |
| | `sys.backup.trigger` | Admin | Snapshot export to portable SQLite DB. | ⏳ |
| | `sys.health` | Public | Readiness check for orchestration. | ✓ |

**Legend**: ✓ Implemented | 🚧 Partially Implemented | ⏳ Planned

---

## Next Steps & Priorities

### Immediate Focus
1. **Complete Torznab API** - Full spec compliance for Sonarr/Radarr integration
2. **Build Search Interface** - Web UI for browsing and searching torrents
3. **API Key System** - Generate and manage keys for external access
4. **Monitoring Dashboard** - Real-time worker status and metrics

### Short-term Goals
1. **Advanced Search Features** - Filters, facets, and complex queries
2. **Bulk Operations** - UI for managing multiple torrents at once
3. **Statistics & Analytics** - Usage metrics and data insights
4. **Documentation** - Complete API docs and deployment guides

### Long-term Vision
1. **Go-based Scrapers** - If needed for performance/network efficiency
2. **Private Tracker Features** - Self-hosted tracker site with view-only access
3. **Advanced Enrichment** - Music (MusicBrainz), Anime (AniList), Books
4. **Export/Backup System** - SQLite exports for portability

### Technical Debt & Improvements
- [ ] Add comprehensive error handling and retry logic to workers
- [ ] Add integration tests for critical paths
- [ ] Optimize Meilisearch queries for better performance
- [ ] Add metrics/observability (Prometheus/Grafana)
- [ ] Create production Docker image with proper multi-stage build
- [ ] Implement database migrations system (currently using push)
- [ ] Add changelog reprocessing (only update if torrent data changed)

See the main [README.md](./README.md) for development setup instructions.
