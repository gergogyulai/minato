import { Client } from "@elastic/elasticsearch";
import { MeiliSearch, type Index } from "meilisearch";
import type { TorrentWithRelations } from "@project-minato/db";

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

export async function setupTorrentIndex(): Promise<Index<TorrentWithRelations>> {
  const index = meiliClient.index<TorrentWithRelations>("torrents");

  await index.updateSearchableAttributes([
    "infoHash",
    "trackerTitle",
    "releaseTitle",
    "size",
    "seeders",
    "leechers",
    "type",
    "files",
    "magnet",
    "sources",
    "enrichment.description",
    "enrichment.tagline",
  ]);

  return index;
}
