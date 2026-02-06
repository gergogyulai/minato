import { Worker, Job } from "bullmq";
import { connection, QUEUES } from "@project-minato/queue";
import {
  db,
  torrents,
  eq,
  enrichments,
  type NewEnrichment,
} from "@project-minato/db";
import { tmdbRateLimiter } from "../rate-limiter";
import { TMDB } from "tmdb-ts";
import { meiliClient } from "@project-minato/meilisearch";
import { getAssetPaths, ingestAsset } from "../utils/media";

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

      if (!tmdbData.results[0]) {
        console.log(
          `[Enrichment Worker] No TMDB results found for torrent ${infoHash}`,
        );
        // Still mark as enriched to avoid retrying
        await db
          .update(torrents)
          .set({ enrichedAt: new Date() })
          .where(eq(torrents.infoHash, infoHash));
        return;
      }

      const tmdbItemData =
        torrentType === "Movie"
          ? await tmdb.movies.details(tmdbData.results[0].id)
          : await tmdb.tvShows.details(tmdbData.results[0].id);

      const assetTasks = [];
      if (tmdbItemData.poster_path) {
        assetTasks.push(
          ingestAsset({
            id: String(tmdbItemData.id),
            url: `https://image.tmdb.org/t/p/w500${tmdbItemData.poster_path}`,
            type: "poster",
          }),
        );
      }
      if (tmdbItemData.backdrop_path) {
        assetTasks.push(
          ingestAsset({
            id: String(tmdbItemData.id),
            url: `https://image.tmdb.org/t/p/w1280${tmdbItemData.backdrop_path}`,
            type: "backdrop",
          }),
        );
      }

      await Promise.allSettled(assetTasks);

      await db.transaction(async (tx) => {
        // Check if enrichment already exists for this torrent
        let enrichment = await tx.query.enrichments.findFirst({
          where: eq(enrichments.torrentInfoHash, infoHash),
        });

        if (!enrichment) {
          const poster = getAssetPaths(tmdbItemData.id, "poster");
          const backdrop = getAssetPaths(tmdbItemData.id, "backdrop");

          const releaseDate = new Date(
            torrentType === "Movie"
              ? (tmdbItemData as any).release_date
              : (tmdbItemData as any).first_air_date) || null;

          const releaseYear = releaseDate
            ? releaseDate.getFullYear()
            : null;

          const runtime =
            torrentType === "Movie"
              ? (tmdbItemData as any).runtime
              : (tmdbItemData as any).episode_run_time?.[0] || 0;

          

          const enrichmentData: NewEnrichment = {
            torrentInfoHash: infoHash,
            tmdbId: tmdbItemData.id,
            mediaType: (torrentType?.toLowerCase() as any) || "movie",
            overview: tmdbItemData.overview,
            tagline: tmdbItemData.tagline,
            releaseDate: releaseDate,
            year: releaseYear,
            runtime: runtime || 0,
            status: tmdbItemData.status,
            genres: tmdbItemData.genres?.map((g) => g.name) || [],
            posterUrl: tmdbItemData.poster_path ? poster.relative : null,
            backdropUrl: tmdbItemData.backdrop_path ? backdrop.relative : null,
            totalSeasons:
              torrentType === "TV"
                ? (tmdbItemData as any).number_of_seasons
                : null,
            totalEpisodes:
              torrentType === "TV"
                ? (tmdbItemData as any).number_of_episodes
                : null,
          };

          const [newEnrichment] = await tx
            .insert(enrichments)
            .values(enrichmentData)
            .returning();
          enrichment = newEnrichment;
        }

        if (!enrichment) {
          console.log(
            `[Enrichment Worker] No enrichment data found for torrent ${infoHash}`,
          );
          return;
        }

        // Update torrent flags
        await tx
          .update(torrents)
          .set({
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

      // Update document in meilisearch with enrichment data
      const enrichedDoc = {
        ...enriched,
        size: enriched.size.toString(),
      };
      await meiliClient
        .index("torrents")
        .updateDocuments([enrichedDoc], { primaryKey: "infoHash" });
      
      console.log(
        `[Enrichment Worker] Updated torrent ${infoHash} in Meilisearch with enrichment data`,
      );
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
