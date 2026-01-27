### Milestone 1: Data Architecture & Monorepo Plumbing
Focus on the "source of truth" and how data flows between TypeScript and Go.
- [ ] **Monorepo Structure**
    - [ ] Setup Turborepo with `apps/api`, `apps/web`, `packages/database`, and `packages/types`.
    - [ ] Initialize `go.work` to manage multiple Go scraper modules.
- [ ] **Drizzle Schema Definition**
    - [ ] Define `torrents` table with `info_hash` (Primary Key), `title`, `size`, `category`, and `magnet`.
    - [ ] Create `sources` table to track which crawler (TPB, DHT, etc.) found which record.
    - [ ] Setup `api_keys` with usage counters and `last_used_at`.
- [ ] **Elasticsearch Mapping**
    - [ ] Create an index template with a `n-gram` analyzer for "fuzzy" title matching (essential for torrent names like `Movie.Title.2024.1080p...`).

### Milestone 2: The Go Ingestion Engine (Scrapers)
Go excels at networking. These services should be "dumb" and simply push data to the API.
- [ ] **The "Scraper-Core" Package**
    - [ ] Build a standard `Result` struct: `Title`, `InfoHash`, `Size`, `Seeders`, `Leechers`.
    - [ ] Implement a circuit breaker to pause scraping if the TS API returns 5xx errors.
- [ ] **Provider Implementation**
    - [ ] **1337x/Knaben Scrapers**: Use `gocolly/colly` to parse HTML. Implement logic to follow "Next Page" up to a configurable depth.
    - [ ] **DHT Crawler**: Implement a metadata wire protocol to fetch `metadata` (filenames/sizes) once an info-hash is found via DHT.
- [ ] **Site Proxy Support**
    - [ ] Build a configuration loader that reads a list of mirrors for each site.

### Milestone 3: The API & Torznab Gateway
- [ ] **Ingestion Pipeline**
    - [ ] Create a `/api/ingest` POST endpoint.
    - [ ] **Upsert Logic**: If `info_hash` exists, update seeders/leechers; if not, create new record.
    - [ ] **Sync to ES**: Trigger a background sync to Elasticsearch after a successful DB write.
- [ ] **Torznab XML Engine**
    - [ ] Implement the `caps` (Capabilities) endpoint so Sonarr/Radarr can "see" supported categories.
    - [ ] Implement the `search` function mapping Torznab query params to Elasticsearch DSL queries.
- [ ] **BetterAuth Integration**
    - [ ] Configure the Admin login flow.
    - [ ] Protect all `/api/admin/*` routes with session checks.

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

### Milestone 5: Optimization & Content Enrichment
- [ ] **The "Classifier" Worker**
    - [ ] Build a Go or TS worker that parses torrent titles (using regex like `anitomy` or `PTN`).
    - [ ] Extract Year, Resolution (1080p/4k), and Codec (x264/h265).
- [ ] **Metadata Enrichment**
    - [ ] Integrate with TMDB/IMDb APIs to link info-hashes to actual movie/show IDs for better filtering.
- [ ] **Database Performance**
    - [ ] Implement table partitioning in PostgreSQL.