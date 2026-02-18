import type { Index } from "meilisearch";
import type { Torrent, Enrichment } from "@project-minato/db";
import { meiliClient } from "./client";
import { RANKING_PROFILES } from "./profiles";

/**
 * Meilisearch Document Type
 * Keeps Enrichment and SeriesDetails nested exactly like the DB relations.
 */
export interface MeiliTorrentDocument extends Omit<Torrent, "size"> {
  size: string;
  sourceNames: string[];
  enrichment?: Enrichment; // Uses the original Enrichment type including seriesDetails
}

/**
 * Formats a database Torrent into a nested MeiliTorrentDocument.
 */
export function formatTorrentForMeilisearch(
  torrent: Torrent & { enrichment?: Enrichment | null }
): MeiliTorrentDocument {
  const { enrichment, ...rest } = torrent;

  const doc: MeiliTorrentDocument = {
    ...rest,
    // Ensure BigInt is stringified for JSON/Search engine safety
    size: torrent.size.toString(),
    // Array of scraper names for easy filtering
    sourceNames: torrent.sources?.map((s) => s.scraper) ?? [],
  };

  if (enrichment) {
    doc.enrichment = enrichment;
  }

  return doc;
}

export async function setupTorrentIndex(): Promise<Index<MeiliTorrentDocument>> {
  const indexName = "torrents";
  
  try {
    await meiliClient.createIndex(indexName, { primaryKey: "infoHash" });
  } catch (e) {
  }

  const index = meiliClient.index<MeiliTorrentDocument>(indexName);

  // 1. Searchable Attributes
  // Notice the triple-dot notation for seriesDetails: enrichment.seriesDetails.episodeTitle
  await index.updateSearchableAttributes([
    "infoHash",
    "enrichment.imdbId",
    "enrichment.tmdbId",
    "enrichment.title",
    "trackerTitle",
    "releaseTitle",
    "type",
    "group",
    "enrichment.overview",
    "enrichment.seriesDetails.episodeTitle", 
    "enrichment.tagline",
  ]);

  // 2. Filterable Attributes
  await index.updateFilterableAttributes([
    "type",
    "resolution",
    "group",
    "sourceNames",
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
    // Filter by nested series properties
    "enrichment.seriesDetails.seasonNumber",
    "enrichment.seriesDetails.episodeNumber",
    "enrichment.seriesDetails.isSeasonPack",
  ]);

  // 3. Sortable Attributes
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

  // 4. Ranking Rules
  await index.updateRankingRules(RANKING_PROFILES.health);

  return index;
}
