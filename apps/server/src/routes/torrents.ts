import { Hono } from "hono";
import {
  db,
  torrents,
  sql,
  blacklistedTorrents,
  blacklistedTrackers,
} from "@project-minato/db";
import { zValidator } from "@hono/zod-validator";
import { ingestQueue } from "@project-minato/queue";
import { IngestTorrentsSchema } from "@/schemas/ingest-torrents.schema";
import type { IngestInput } from "@/schemas/ingest-torrents.schema";
import { z } from "zod";
// import { meiliClient } from "@project-minato/meilisearch";

const app = new Hono();

app.post(
  "/ingest",
  zValidator("json", z.array(IngestTorrentsSchema).min(1)),
  async (c) => {
    const scraperId = c.req.header("X-Minato-Scraper");

    if (!scraperId || scraperId.trim() === "") {
      return c.json(
        { message: "Missing or invalid X-Minato-Scraper header" },
        400,
      );
    }

    const validatedData = c.req.valid("json");

    if (validatedData.length === 0) {
      return c.json({ message: "No torrents provided" }, 400);
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
        return c.json(
          { message: "No new torrents added (all blacklisted or empty)" },
          200,
        );
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

      return c.json(
        {
          count: results.length,
          message: `Successfully ingested and queued ${results.length} torrents`,
        },
        202,
      );
    } catch (error) {
      console.error("Ingestion Error:", error);
      return c.json({ message: "Internal Server Error" }, 500);
    }
  },
);


export default app;