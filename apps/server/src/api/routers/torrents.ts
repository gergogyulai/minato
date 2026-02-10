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
import type { IngestInput } from "@/schemas/ingest-torrents.schema";
import {
  ingestContract,
  updateContract,
  deleteContract,
} from "../contracts/torrent.contracts";

export const torrentRouter = {
  ingest: ingestContract.handler(async ({ input, context }) => {
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

  update: updateContract.handler(async ({ input }) => {
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
    if (updateFields.files !== undefined) updateData.files = updateFields.files;
    if (updateFields.magnet !== undefined)
      updateData.magnet = updateFields.magnet;
    if (updateFields.type !== undefined) updateData.type = updateFields.type;
    if (updateFields.group !== undefined) updateData.group = updateFields.group;
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

  delete: deleteContract.handler(async ({ input }) => {
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
};
