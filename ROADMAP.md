### Milestone 1: Data Architecture & Monorepo Plumbing
Focus on the "source of truth" and how data flows between TypeScript and Go.
- [X] **Monorepo Structure**
    - [x] Setup Turborepo with `apps/api`, `apps/web`, `packages/database`, and `packages/types`.
    - [ ] Initialize `go.work` to manage multiple Go scraper modules.
- [X] **Drizzle Schema Definition**
- [ ] **Meilisearch**
    - [ ] Create an index template.
    - [ ] Configure ranking rules to prioritize health (seeders) and recency.

### Milestone 2: Scraper Infrastructure

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

### Milestone 3: The API & Workers
- [x] **Ingestion Pipeline**
    - [x] Create a `/api/ingest` POST endpoint.
    - [ ] Create bulk ingestion `/api/ingest/bulk` POST endpoint.
    - [ ] Create `.torrent` file ingestion `/api/ingest/file` POST endpoint to ingest torrent files into the database.
    - [x] **Upsert Logic**: If `info_hash` exists, update seeders/leechers; if not, create new record.
    - [x] **Sync to Meilisearch**: Trigger a background sync to Meilisearch after a successful DB write.
- [ ] **Torznab XML Engine**
    - [Api spec docs](https://torznab.github.io/spec-1.3-draft/torznab/index.html)
    - [ ] Implement the `caps` (Capabilities) endpoint so Sonarr/Radarr can "see" supported categories.
    - [ ] Implement the `search` function mapping Torznab query params to Elasticsearch DSL queries.
- [ ] **BetterAuth Integration**
    - [ ] Protect all routes with session or API key checks.
    - [ ] `X-Internal-Secret` auth for scraper-to-API communication.
- [x] **The Classifier**
    - [x] Parse torrent titles.
    - [ ] Natural language processing for titles to handle weird formatting not parsable using regex
    - [x] Extract Year, Resolution (1080p/4k), and Codec (x264/h265), etc.
- [x] **Metadata Enrichment**
    - [x] Integrate with TMDb API to link info-hashes to actual movie/show IDs for better filtering.
    - [ ] Integrate with some kind of music metadata provider
    - [ ] Integrate with anilist for Anime
- [ ] **Mirror Health Worker**:
    - A background task that pings the configured mirror lists for each site (e.g., the six 1337x domains) and flags which ones are currently online.

### Milestone 4: The Next.js Dashboard
A modern UI to visualize the massive amount of data being indexed.
- [ ] **Search Interface**
    - [ ] Build a high-performance search bar using TanStack Query.
    - [ ] Implement "Instant Search" as the user types, hitting the Elasticsearch endpoint directly.
- [ ] **Real-time Monitoring**
    - [ ] Create a dashboard widget showing "Torrents Indexed per Minute" using a simple SQL `COUNT` grouped by hour.
    - [ ] Add a "Crawler Status" page showing which Go services are currently online and their last heartbeat.
- [ ] **Management Tools**
    - [ ] Build the API Key generator UI.
    - [ ] Implement a "Manual Re-index" button that clears Elasticsearch and repopulates it from PostgreSQL.
