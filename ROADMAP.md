### Milestone 1: Data Architecture & Monorepo Plumbing
Focus on the "source of truth" and how data flows between TypeScript and Go.
- [X] **Monorepo Structure**
    - [x] Setup Turborepo with `apps/api`, `apps/web`, `packages/database`, and `packages/types`.
    - [ ] Initialize `go.work` to manage multiple Go scraper modules.
- [X] **Drizzle Schema Definition**
- [ ] **Meilisearch**
    - [ ] Create an index template.
    - [ ] Configure ranking rules to prioritize health (seeders) and recency.

### Milestone 2: The Go Scrapers
Go excels at networking. These services should be "dumb" and simply push data to the API.
- [ ] **The "Scraper-Core" Package**
    - [ ] Implement a circuit breaker to pause scraping if the TS API returns 5xx errors.
- [ ] **Provider Implementation**
    - [ ] **1337x/Knaben Scrapers**: Use `gocolly/colly` to parse HTML. Implement logic to follow "Next Page" up to a configurable depth.
    - [ ] **DHT Crawler**: Implement a metadata wire protocol to fetch `metadata` (filenames/sizes) once an info-hash is found via DHT.
- [ ] **Site Proxy Support**
    - [ ] Build a configuration loader that reads a list of mirrors for each site.

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
