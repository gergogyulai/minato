# Project Minato - Job Workers

This service implements the three-pass queue system for torrent indexing and enrichment.

## Architecture

### Pass 1: Immediate Indexing (Ingest Worker)
- **Queue**: `TORRENT_INGEST`
- **Purpose**: Fast indexing for immediate searchability
- **Process**:
  1. Pulls job from Redis
  2. Fetches torrent from PostgreSQL
  3. Adds title and infoHash to in-memory buffer
  4. Buffer flushes to Elasticsearch when:
     - 500 items accumulated, OR
     - 5 seconds elapsed
  5. Updates `indexed_at` timestamp in PostgreSQL
  6. Queues enrichable torrents for Pass 2

### Pass 2: Enrichment (Enrichment Worker)
- **Queue**: `CLASSIFY`
- **Purpose**: Fetch rich metadata from external APIs
- **Process**:
  1. Checks if torrent is enrichable (movie-like title)
  2. Rate-limits TMDB API calls (2 requests/second, max 20 tokens)
  3. Searches TMDB for movie/TV show data
  4. Saves poster URL, description, year, rating to PostgreSQL
  5. Updates `enriched_at` timestamp
  6. Queues for Pass 3 re-indexing

### Pass 3: Re-Indexing (Sync Worker)
- **Queue**: `ES_SYNC`
- **Purpose**: Sync enriched data to Elasticsearch
- **Process**:
  1. Fetches complete torrent data from PostgreSQL (source of truth)
  2. Extracts enriched metadata
  3. Adds to buffer for bulk Elasticsearch update
  4. UI now shows poster and metadata in search results

## Buffer System

The `ElasticsearchBuffer` batches documents to optimize Elasticsearch performance:
- **Max Size**: 500 documents
- **Max Time**: 5 seconds
- **Auto-flush**: Triggers on either condition
- **Graceful Shutdown**: Flushes remaining documents on SIGINT/SIGTERM

## Rate Limiting

TMDB API calls are protected by a token bucket rate limiter:
- **Max Tokens**: 20
- **Refill Rate**: 2 tokens/second
- **Prevents**: API bans from excessive requests

## Environment Variables

```bash
# Redis (BullMQ)
REDIS_HOST=localhost
REDIS_PORT=6379

# Elasticsearch
ELASTICSEARCH_NODE=http://localhost:9200
ELASTICSEARCH_API_KEY=your_api_key

# TMDB (The Movie Database)
TMDB_API_KEY=your_tmdb_api_key
```

## Running the Workers

```bash
# Development (with hot reload)
bun run dev

# Production
bun run start
```

## Worker Concurrency

- **Ingest Worker**: 1 concurrent job (buffer handles batching)
- **Enrichment Worker**: 5 concurrent jobs (rate limiter controls API calls)
- **Sync Worker**: 10 concurrent jobs (fast database reads)

## Monitoring

Workers log their progress:
- `[Ingest Worker]` - Indexing events
- `[Enrichment Worker]` - TMDB enrichment status
- `[Sync Worker]` - Re-indexing events
- `[Rate Limiter]` - API throttling

## Job Flow Example

```
1. New torrent "Inception.2010.1080p.BluRay.x264"
   ↓
2. [Ingest Worker] Indexes basic data → searchable in <5s
   ↓
3. [Enrichment Worker] Fetches TMDB data → poster, rating saved
   ↓
4. [Sync Worker] Re-indexes with enriched data → UI shows poster
```

## Graceful Shutdown

Press `Ctrl+C` to trigger:
1. Stop accepting new jobs
2. Complete in-flight jobs
3. Flush buffered Elasticsearch documents
4. Close all connections

## Error Handling

- Failed jobs automatically retry (BullMQ default: 3 attempts)
- Elasticsearch bulk errors are logged individually
- Rate limiter ensures no TMDB API abuse
- Torrent data always persists in PostgreSQL (source of truth)
