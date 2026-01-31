import { Worker, Job } from "bullmq";
import { connection, QUEUES } from "@project-minato/queue";
import { db, torrents, eq, enrichments, type TorrentWithRelations } from "@project-minato/db";
import { tmdbRateLimiter } from "../rate-limiter";
import { TMDB } from "tmdb-ts";
import { meiliClient } from "@project-minato/meilisearch";


const tmdb = new TMDB(
  "eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiIzMWFkNjkxMTUzZWRkMzA5ZGFjYzRiOTJiMGFiNDQzZCIsIm5iZiI6MTcxMTgzMTc1NC43NTQsInN1YiI6IjY2MDg3YWNhMjgzZWQ5MDE0OTE4NjcwZCIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.ct4uXA3LWo8IZcgD4NXcY_dXpakWM9mw0rlFOJoU6gc",
);

interface EnrichJobData {
  infoHash: string;
}

export function startEnrichmentWorker() {
  const worker = new Worker<EnrichJobData>(
    QUEUES.ENRICH,
    async (job: Job<EnrichJobData>) => {
      console.log(
        `[Enrichment Worker] Processing job ${job.id} for torrent ${job.data.infoHash}`,
      );

      const { infoHash } = job.data;

      const [torrent] = await db
        .select()
        .from(torrents)
        .where(eq(torrents.infoHash, infoHash))
        .limit(1);

      if (!torrent) {
        console.error(`[Enrichment Worker] Torrent not found: ${infoHash}`);
        return;
      }

      // Skip if already enriched
      if (torrent.enrichedAt) {
        console.log(
          `[Enrichment Worker] Torrent ${infoHash} already enriched, skipping`,
        );
        return;
      }

      // Rate limit before calling TMDB
      await tmdbRateLimiter.waitForToken();
      const year = Number(torrent.releaseData?.year) || null;
      const cleanTitle = torrent.releaseData?.title;
      const torrentType = torrent.type;

      if (!cleanTitle || !year) {
        console.log(
          `[Enrichment Worker] Torrent ${infoHash} has no valid title or year for enrichment`,
        );
        // Still mark as enriched to avoid retrying
        await db
          .update(torrents)
          .set({ enrichedAt: new Date() })
          .where(eq(torrents.infoHash, infoHash));
        return;
      }

      const tmdbData =
        torrentType === "Movie"
          ? await tmdb.search.movies({ query: cleanTitle, year })
          : await tmdb.search.tvShows({
              query: cleanTitle,
              first_air_date_year: year,
            });

      await db.transaction(async (tx) => {
        let enrichment = await tx.query.enrichments.findFirst({
          where: eq(enrichments.tmdbId, tmdbData.results[0]?.id || 0),
        });

        if (!enrichment && tmdbData.results.length > 0 && tmdbData.results[0]) {
          const result = tmdbData.results[0];
          const [newEnrichment] = await tx
            .insert(enrichments)
            .values({
              tmdbId: result.id,
            })
            .returning();
          enrichment = newEnrichment;
        }

        if (!enrichment) {
          console.log(
            `[Enrichment Worker] No enrichment data found for torrent ${infoHash}`,
          );
          return;
        }

        await tx
          .update(torrents)
          .set({
            enrichmentId: enrichment.id,
            isDirty: false,
            enrichedAt: new Date(),
          })
          .where(eq(torrents.infoHash, torrent.infoHash));
      });

      const enriched = await db.query.torrents.findFirst({
        where: eq(torrents.infoHash, infoHash),
        with: {
          enrichment: true,
        },
      });

      if (!enriched) {
        return;
      }

      await meiliClient.index<TorrentWithRelations>("torrents").updateDocuments([enriched]);
    },
    {
      connection,
      concurrency: 5, // Process 5 enrichments concurrently (rate limiter will control API calls)
    },
  );

  worker.on("completed", (job) => {
    console.log(`[Enrichment Worker] Job ${job.id} completed`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[Enrichment Worker] Job ${job?.id} failed:`, err);
  });

  console.log("[Enrichment Worker] Started and listening for jobs...");

  return worker;
}
