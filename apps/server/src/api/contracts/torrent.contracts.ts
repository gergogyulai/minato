import { z } from "zod";
import { publicProcedure } from "..";
import { IngestTorrentsSchema } from "@/schemas/ingest-torrents.schema";
import { IngestTorrentsResponseSchema } from "@/schemas/ingest-torrents.schema";
import {
  UpdateTorrentSchema,
  UpdateTorrentResponseSchema,
} from "@/schemas/update-torrents.schema";
import {
  DeleteTorrentsSchema,
  DeleteTorrentsResponseSchema,
} from "@/schemas/delete-torrents.schema";
import {
  TorrentSchema,
  EnrichmentSchema,
} from "@project-minato/db";

/**
 * Contract-first API definitions for torrent operations
 * These contracts define the shape of the API without implementation details
 */
export const getContract = publicProcedure
  .route({
    method: "GET",
    path: "/torrents/:infoHash",
    summary: "Get torrent by info hash",
    description:
      "Retrieve detailed information about a torrent by its info hash.",
    tags: ["torrents"],
  })
  .input(
    z.object({
      infoHash: z
        .string()
        .length(40)
        .transform((h) => h.toLowerCase()),
    }),
  )
  .output(
    TorrentSchema.extend({
      enrichment: EnrichmentSchema.nullable(),
    }),
  );

export const getCountContract = publicProcedure
  .route({
    method: "GET",
    path: "/torrents/count",
    summary: "Get total torrent count",
    description: "Retrieve the total number of torrents in the database.",
    tags: ["torrents"],
  })
  .input(z.void())
  .output(z.object({ count: z.number() }));

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