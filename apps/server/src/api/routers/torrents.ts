import { publicProcedure } from "..";
import { ORPCError } from "@orpc/server";
import {
  db,
  torrents,
  sql,
  blacklistedTorrents,
  blacklistedTrackers,
  eq,
  inArray,
} from "@project-minato/db";
import { ingestQueue } from "@project-minato/queue";
import { IngestTorrentsSchema } from "@/schemas/ingest-torrents.schema";
import type { IngestInput } from "@/schemas/ingest-torrents.schema";
import { z } from "zod";

export const torrentRouter = {
  ingest: publicProcedure
    .route({
      method: "POST",
      path: "/torrents/ingest",
      summary: "Ingest torrents",
      description:
        "Bulk ingest torrents from scrapers. Filters blacklisted torrents and trackers, performs deduplication, and queues for indexing.",
      tags: ["torrents"],
    })
    .input(z.array(IngestTorrentsSchema).min(1))
    .handler(async ({ input, context }) => {
      const scraperId = context.honoContext.req.header("X-Minato-Scraper");

      if (!scraperId || scraperId.trim() === "") {
        throw new ORPCError("BAD_REQUEST", {
          message: "Missing or invalid X-Minato-Scraper header",
        });
      }

      const validatedData = input;

      if (validatedData.length === 0) {
        throw new ORPCError("BAD_REQUEST", {
          message: "No torrents provided",
        });
      }

      const uniqueInputs = Array.from(
        validatedData
          .reduce(
            (map, item) => map.set(item.infoHash, item),
            new Map<string, IngestInput>(),
          )
          .values(),
      );

      try {
        const results = await db.transaction(async (tx) => {
          // Fetch Blacklists (Cache these in Redis in production!)
          const rawBlacklistedHashes = await tx
            .select({ hash: blacklistedTorrents.infoHash })
            .from(blacklistedTorrents);

          const rawBlacklistedTrackers = await tx
            .select({ url: blacklistedTrackers.url })
            .from(blacklistedTrackers);

          const blacklistedHashSet = new Set(
            rawBlacklistedHashes.map((entry) => entry.hash),
          );
          const blacklistedTrackerUrls = rawBlacklistedTrackers.flatMap(
            (tracker) => tracker.url,
          );

          const validTorrents = uniqueInputs.filter((torrent) => {
            const isHashBlacklisted = blacklistedHashSet.has(torrent.infoHash);
            if (isHashBlacklisted) return false;

            const torrentSourceUrl = torrent.source.url;
            if (!torrentSourceUrl) return true;

            const containsBlacklistedTracker = blacklistedTrackerUrls.some(
              (keyword) => keyword && torrentSourceUrl.includes(keyword),
            );

            return !containsBlacklistedTracker;
          });

          if (validTorrents.length === 0) return [];

          const values = validTorrents.map((item) => ({
            infoHash: item.infoHash,
            trackerTitle: item.title,
            trackerCategory: item.category,
            size: Number(item.size),
            seeders: item.seeders,
            leechers: item.leechers,
            magnet: item.magnet,
            files: item.files,
            isDirty: true,
            sources: [
              {
                name: item.source.name,
                url: item.source.url ?? null,
                scraper: scraperId,
              },
            ],
          }));

          return tx
            .insert(torrents)
            .values(values)
            .onConflictDoUpdate({
              target: torrents.infoHash,
              set: {
                seeders: sql`excluded.seeders`,
                leechers: sql`excluded.leechers`,
                isDirty: true,
                lastSeenAt: sql`now()`,
                sources: sql`
                  (SELECT jsonb_agg(DISTINCT e) 
                   FROM jsonb_array_elements(${torrents.sources} || excluded.sources) AS e)
                `,
              },
            })
            .returning({ infoHash: torrents.infoHash });
        });

        if (results.length === 0) {
          return {
            count: 0,
            message: "No new torrents added (all blacklisted or empty)",
          };
        }

        // Instead of awaiting each, use Promise.all for speed
        await Promise.all(
          results.map((t) =>
            ingestQueue.add("index", {
              infoHash: t.infoHash,
              _benchmark: { ingestedAt: Date.now() },
            }),
          ),
        );

        return {
          count: results.length,
          message: `Successfully ingested and queued ${results.length} torrents`,
        };
      } catch (error) {
        console.error("Ingestion Error:", error);
        throw new ORPCError("INTERNAL_SERVER_ERROR", {
          message: "Internal Server Error",
        });
      }
    }),

  update: publicProcedure
    .route({
      method: "POST",
      path: "/torrents/update",
      summary: "Update torrent",
      description:
        "Update any fields of an existing torrent by info hash. Only provided fields will be updated in the database.",
      tags: ["torrents"],
    })
    .input(
      z.object({
        infoHash: z
          .string()
          .length(40)
          .describe("The 40-character info hash of the torrent"),
        trackerTitle: z.string().optional().describe("Title from the tracker"),
        seeders: z
          .number()
          .int()
          .min(0)
          .optional()
          .describe("Number of seeders"),
        leechers: z
          .number()
          .int()
          .min(0)
          .optional()
          .describe("Number of leechers"),
        trackerCategory: z
          .string()
          .optional()
          .describe("Category from the tracker"),
        standardCategory: z
          .number()
          .int()
          .optional()
          .describe("Standardized category ID"),
        files: z
          .array(
            z.object({
              filename: z.string(),
              size: z.number().int(),
            }),
          )
          .optional()
          .describe("Array of file information"),
        magnet: z.string().optional().describe("Magnet link"),
        type: z.string().optional().describe("Release type (movie, tv, etc.)"),
        group: z.string().optional().describe("Release group"),
        resolution: z.string().optional().describe("Video resolution"),
        releaseTitle: z.string().optional().describe("Parsed release title"),
      }),
    )
    .handler(async ({ input }) => {
      const { infoHash, ...updateFields } = input;

      // Check if torrent exists
      const existing = await db
        .select({ infoHash: torrents.infoHash })
        .from(torrents)
        .where(eq(torrents.infoHash, infoHash.toLowerCase()))
        .limit(1);

      if (existing.length === 0) {
        throw new ORPCError("NOT_FOUND", {
          message: `Torrent with infoHash ${infoHash} not found`,
        });
      }

      // Build update object with only provided fields
      const updateData: Record<string, any> = {};

      if (updateFields.trackerTitle !== undefined)
        updateData.trackerTitle = updateFields.trackerTitle;
      if (updateFields.seeders !== undefined)
        updateData.seeders = updateFields.seeders;
      if (updateFields.leechers !== undefined)
        updateData.leechers = updateFields.leechers;
      if (updateFields.trackerCategory !== undefined)
        updateData.trackerCategory = updateFields.trackerCategory;
      if (updateFields.standardCategory !== undefined)
        updateData.standardCategory = updateFields.standardCategory;
      if (updateFields.files !== undefined)
        updateData.files = updateFields.files;
      if (updateFields.magnet !== undefined)
        updateData.magnet = updateFields.magnet;
      if (updateFields.type !== undefined) updateData.type = updateFields.type;
      if (updateFields.group !== undefined)
        updateData.group = updateFields.group;
      if (updateFields.resolution !== undefined)
        updateData.resolution = updateFields.resolution;
      if (updateFields.releaseTitle !== undefined)
        updateData.releaseTitle = updateFields.releaseTitle;

      if (Object.keys(updateData).length === 0) {
        throw new ORPCError("BAD_REQUEST", {
          message: "No fields provided to update",
        });
      }

      await db
        .update(torrents)
        .set(updateData)
        .where(eq(torrents.infoHash, infoHash.toLowerCase()));

      return {
        success: true,
        updatedFields: Object.keys(updateData),
        message: `Torrent ${infoHash} updated successfully with ${Object.keys(updateData).length} field(s)`,
      };
    }),

  delete: publicProcedure
    .route({
      method: "POST",
      path: "/torrents/delete",
      summary: "Delete torrents",
      description:
        "Permanently delete one or more torrents from the database by their info hashes.",
      tags: ["torrents"],
    })
    .input(
      z.object({
        infoHashes: z
          .array(z.string().length(40))
          .min(1)
          .describe("Array of 40-character info hashes to delete"),
      }),
    )
    .handler(async ({ input }) => {
      const { infoHashes } = input;
      const normalizedHashes = infoHashes.map((h) => h.toLowerCase());

      const deleted = await db
        .delete(torrents)
        .where(inArray(torrents.infoHash, normalizedHashes))
        .returning({ infoHash: torrents.infoHash });

      return {
        success: true,
        count: deleted.length,
        message: `Successfully deleted ${deleted.length} torrent(s)`,
        deletedHashes: deleted.map((t) => t.infoHash),
      };
    }),

  blacklist: publicProcedure
    .route({
      method: "POST",
      path: "/torrents/blacklist",
      summary: "Blacklist torrents",
      description:
        "Add torrents to the blacklist to prevent future ingestion. Optionally deletes them from the database.",
      tags: ["torrents"],
    })
    .input(
      z.object({
        infoHashes: z
          .array(z.string().length(40))
          .min(1)
          .describe("Array of 40-character info hashes to blacklist"),
        reason: z
          .string()
          .min(1)
          .describe("Reason for blacklisting these torrents"),
        deleteFromDatabase: z
          .boolean()
          .default(true)
          .describe(
            "Whether to delete torrents from database after blacklisting",
          ),
      }),
    )
    .handler(async ({ input }) => {
      const { infoHashes, reason, deleteFromDatabase } = input;
      const normalizedHashes = infoHashes.map((h) => h.toLowerCase());

      try {
        const result = await db.transaction(async (tx) => {
          // Insert into blacklist
          const blacklisted = await tx
            .insert(blacklistedTorrents)
            .values(
              normalizedHashes.map((hash) => ({
                infoHash: hash,
                reason,
              })),
            )
            .onConflictDoUpdate({
              target: blacklistedTorrents.infoHash,
              set: { reason },
            })
            .returning({ infoHash: blacklistedTorrents.infoHash });

          // Optionally delete from torrents table
          let deleted: { infoHash: string }[] = [];
          if (deleteFromDatabase) {
            deleted = await tx
              .delete(torrents)
              .where(inArray(torrents.infoHash, normalizedHashes))
              .returning({ infoHash: torrents.infoHash });
          }

          return { blacklisted, deleted };
        });

        return {
          success: true,
          blacklistedCount: result.blacklisted.length,
          deletedCount: result.deleted.length,
          message: `Successfully blacklisted ${result.blacklisted.length} torrent(s)${
            deleteFromDatabase
              ? ` and deleted ${result.deleted.length} from database`
              : ""
          }`,
          blacklistedHashes: result.blacklisted.map((t) => t.infoHash),
        };
      } catch (error) {
        console.error("Blacklist Error:", error);
        throw new ORPCError("INTERNAL_SERVER_ERROR", {
          message: "Failed to blacklist torrents",
        });
      }
    }),
  
};
