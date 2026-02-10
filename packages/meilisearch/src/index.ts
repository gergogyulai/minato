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

// Helper function to flatten enrichment data for Meilisearch
export function formatTorrentForMeilisearch(torrent: TorrentDocument): any {
  const doc: any = {
    ...torrent,
    // Convert bigint to string for JSON serialization
    size: torrent.size.toString(),
  };

  // If torrent has enrichment relation, flatten it with dot notation
  if ('enrichment' in torrent && torrent.enrichment) {
    const enrichment = torrent.enrichment;
    // Remove the nested enrichment object
    delete doc.enrichment;
    
    // Add flattened enrichment fields with dot notation
    doc['enrichment.overview'] = enrichment.overview;
    doc['enrichment.tagline'] = enrichment.tagline;
    doc['enrichment.year'] = enrichment.year;
    doc['enrichment.genres'] = enrichment.genres;
    doc['enrichment.mediaType'] = enrichment.mediaType;
    doc['enrichment.posterUrl'] = enrichment.posterUrl;
    doc['enrichment.backdropUrl'] = enrichment.backdropUrl;
    doc['enrichment.releaseDate'] = enrichment.releaseDate;
    doc['enrichment.status'] = enrichment.status;
    doc['enrichment.runtime'] = enrichment.runtime;
    doc['enrichment.tmdbId'] = enrichment.tmdbId;
    doc['enrichment.imdbId'] = enrichment.imdbId;
    doc['enrichment.contentRating'] = enrichment.contentRating;
    doc['enrichment.totalSeasons'] = enrichment.totalSeasons;
    doc['enrichment.totalEpisodes'] = enrichment.totalEpisodes;
  }

  return doc;
}

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

  // console.log("[Meilisearch] Torrent index configured successfully");

  return index;
}