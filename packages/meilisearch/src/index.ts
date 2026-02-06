import { Client } from "@elastic/elasticsearch";
import { MeiliSearch, type Index } from "meilisearch";
import type { Torrent, TorrentWithRelations } from "@project-minato/db";

export const elasticClient = new Client({
  node: process.env.ELASTICSEARCH_NODE || "http://localhost:9200",
  auth: {
    apiKey: process.env.ELASTICSEARCH_API_KEY || "",
  },
});

export const meiliClient = new MeiliSearch({
  host: process.env.MEILISEARCH_HOST || "http://localhost:7700",
  apiKey:
    process.env.MEILISEARCH_MASTER_KEY || "masterKey_change_me_in_production",
});

// Type that accepts both plain Torrent and TorrentWithRelations
type TorrentDocument = Torrent | TorrentWithRelations;

export async function setupTorrentIndex(): Promise<Index<TorrentDocument>> {
  try {
    await meiliClient.createIndex("torrents", { primaryKey: "infoHash" });
  } catch (e) {
    // Index might already exist
  }
  const index = meiliClient.index<TorrentDocument>("torrents");

  // Configure searchable attributes
  await index.updateSearchableAttributes([
    "infoHash",
    "trackerTitle",
    "releaseTitle",
    "type",
    "group",
    "enrichment.overview",
    "enrichment.tagline",
  ]);

  // Configure filterable attributes
  await index.updateFilterableAttributes([
    "type",
    "resolution",
    "group",
    "seeders",
    "leechers",
    "size",
    "createdAt",
    "updatedAt",
    "enrichment.year",
    "enrichment.genres",
    "enrichment.mediaType",
  ]);

  // Configure sortable attributes
  await index.updateSortableAttributes([
    "seeders",
    "leechers",
    "size",
    "createdAt",
    "updatedAt",
  ]);

  // Configure ranking rules - prioritize freshness and health
  await index.updateRankingRules([
    "words",           // Match words in search query first
    "typo",            // Then tolerance for typos
    "proximity",       // Then word proximity
    "attribute",       // Then attribute ranking
    "sort",            // Allow custom sorting
    "exactness",       // Then exact matches
    "seeders:desc",    // HEALTH: Prioritize torrents with more seeders
    "createdAt:desc",  // FRESHNESS: Prioritize newer torrents
  ]);

  console.log("[Meilisearch] Torrent index configured successfully");

  return index;
}