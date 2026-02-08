import { z } from "zod";
import { publicProcedure } from "..";
import { IngestTorrentsSchema } from "@/schemas/ingest-torrents.schema";
import { IngestTorrentsResponseSchema } from "@/schemas/ingest-response.schema";
import { UpdateTorrentSchema, UpdateTorrentResponseSchema } from "@/schemas/update-torrents.schema";
import { DeleteTorrentsSchema, DeleteTorrentsResponseSchema } from "@/schemas/delete-torrents.schema";
import { BlacklistTorrentsSchema, BlacklistTorrentsResponseSchema } from "@/schemas/blacklist-torrents.schema";

/**
 * Contract-first API definitions for torrent operations
 * These contracts define the shape of the API without implementation details
 */

export const ingestContract = publicProcedure
  .route({
    method: "POST",
    path: "/torrents/ingest",
    summary: "Ingest torrents",
    description:
      "Bulk ingest torrents from scrapers. Filters blacklisted torrents and trackers, performs deduplication, and queues for indexing.",
    tags: ["torrents"],
  })
  .input(z.array(IngestTorrentsSchema).min(1))
  .output(IngestTorrentsResponseSchema);

export const updateContract = publicProcedure
  .route({
    method: "POST",
    path: "/torrents/update",
    summary: "Update torrent",
    description:
      "Update any fields of an existing torrent by info hash. Only provided fields will be updated in the database.",
    tags: ["torrents"],
  })
  .input(UpdateTorrentSchema)
  .output(UpdateTorrentResponseSchema);

export const deleteContract = publicProcedure
  .route({
    method: "POST",
    path: "/torrents/delete",
    summary: "Delete torrents",
    description:
      "Permanently delete one or more torrents from the database by their info hashes.",
    tags: ["torrents"],
  })
  .input(DeleteTorrentsSchema)
  .output(DeleteTorrentsResponseSchema);

export const blacklistContract = publicProcedure
  .route({
    method: "POST",
    path: "/torrents/blacklist",
    summary: "Blacklist torrents",
    description:
      "Add torrents to the blacklist to prevent future ingestion. Optionally deletes them from the database.",
    tags: ["torrents"],
  })
  .input(BlacklistTorrentsSchema)
  .output(BlacklistTorrentsResponseSchema);
