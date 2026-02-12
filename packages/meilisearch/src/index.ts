import { MeiliSearch, type Index } from "meilisearch";
import type { Torrent, TorrentWithRelations } from "@project-minato/db";

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

  // Flatten sources array for filtering by scraper name
  if (torrent.sources && Array.isArray(torrent.sources)) {
    doc.sourceNames = torrent.sources.map((s: any) => s.scraper);
  }

  // If torrent has enrichment relation, flatten it with dot notation
  if ("enrichment" in torrent && torrent.enrichment) {
    const enrichment = torrent.enrichment;
    // Remove the nested enrichment object
    delete doc.enrichment;

    // Add flattened enrichment fields with dot notation
    doc["enrichment.title"] = enrichment.title;
    doc["enrichment.overview"] = enrichment.overview;
    doc["enrichment.tagline"] = enrichment.tagline;
    doc["enrichment.year"] = enrichment.year;
    doc["enrichment.genres"] = enrichment.genres;
    doc["enrichment.mediaType"] = enrichment.mediaType;
    doc["enrichment.posterUrl"] = enrichment.posterUrl;
    doc["enrichment.backdropUrl"] = enrichment.backdropUrl;
    doc["enrichment.releaseDate"] = enrichment.releaseDate;
    doc["enrichment.status"] = enrichment.status;
    doc["enrichment.runtime"] = enrichment.runtime;
    doc["enrichment.contentRating"] = enrichment.contentRating;
    doc["enrichment.tmdbId"] = enrichment.tmdbId;
    doc["enrichment.imdbId"] = enrichment.imdbId;
    doc["enrichment.tvdbId"] = enrichment.tvdbId;
    doc["enrichment.anilistId"] = enrichment.anilistId;
    doc["enrichment.malId"] = enrichment.malId;
    doc["enrichment.seasonNumber"] = enrichment.seriesDetails?.seasonNumber;
    doc["enrichment.episodeNumber"] = enrichment.seriesDetails?.episodeNumber;
    doc["enrichment.episodeTitle"] = enrichment.seriesDetails?.episodeTitle;
    doc["enrichment.isSeasonPack"] = enrichment.seriesDetails?.isSeasonPack;
    doc["enrichment.totalSeasons"] = enrichment.seriesDetails?.totalSeasons;
    doc["enrichment.totalEpisodes"] = enrichment.seriesDetails?.totalEpisodes;
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
    "infoHash", // High priority for exact matches
    "enrichment.imdbId", // Added for identifier matching
    "enrichment.tmdbId", // Added for identifier matching
    "enrichment.title", // Enriched title (e.g., "The Matrix")
    "trackerTitle", // Original tracker title
    "releaseTitle", // Parsed release title
    "type",
    "group",
    "enrichment.overview",
    "enrichment.tagline",
  ]);

  await index.updateFilterableAttributes([
    "type",
    "resolution",
    "group",
    "sourceNames", // Array of scraper names for source filtering
    "seeders",
    "leechers",
    "size",
    "publishedAt",
    "createdAt",
    "updatedAt",
    "enrichment.year",
    "enrichment.genres",
    "enrichment.mediaType",
    "enrichment.imdbId",
    "enrichment.tmdbId",
    "enrichment.seasonNumber",
    "enrichment.episodeNumber",
    "enrichment.isSeasonPack",
  ]);

  // Configure sortable attributes
  await index.updateSortableAttributes([
    "trackerTitle",
    "releaseTitle",
    "seeders",
    "leechers",
    "size",
    "publishedAt",
    "createdAt",
    "updatedAt",
  ]);

  // Configure ranking rules - prioritize freshness and health
  await index.updateRankingRules([
    "words", // Match words in search query first
    "typo", // Then tolerance for typos
    "proximity", // Then word proximity
    "attribute", // Then attribute ranking
    "sort", // Allow custom sorting
    "exactness", // Then exact matches
    "seeders:desc", // HEALTH: Prioritize torrents with more seeders
    "createdAt:desc", // FRESHNESS: Prioritize newer torrents
  ]);

  // console.log("[Meilisearch] Torrent index configured successfully");

  return index;
}

export * from "./batcher";