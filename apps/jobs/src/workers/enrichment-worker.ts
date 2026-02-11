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
import { meiliClient, formatTorrentForMeilisearch } from "@project-minato/meilisearch";
import { getLocalAssetPaths, ingestAsset } from "../utils/media";
import { TMDBProvider } from "../lib/providers/tmdb";

const tmdbProvider = new TMDBProvider(process.env.TMDB_READ_ACCESS_TOKEN!);
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
      const torrentType = torrent.type?.toLowerCase() as "movie" | "tv" | undefined | null;

      if (!torrentType || !tmdbProvider.supportedTypes.includes(torrentType)) {
        console.log(
          `[Enrichment Worker] Torrent ${infoHash} has unsupported type "${torrent.type}", skipping enrichment`,
        );
        // Still mark as enriched to avoid retrying
        await db
          .update(torrents)
          .set({ enrichedAt: new Date() })
          .where(eq(torrents.infoHash, infoHash));
        return;
      }

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
      
      const tmdbMetadata = await tmdbProvider.find(cleanTitle, year, torrentType);

      if (!tmdbMetadata) {
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

      const assetTasks = [];
      if (tmdbMetadata.poster_path) {
        assetTasks.push(
          ingestAsset({
            id: String(tmdbMetadata.tmdb_id),
            url: tmdbProvider.getAssetUrl(tmdbMetadata.poster_path, "poster"),
            type: "poster",
          }),
        );
      }
      if (tmdbMetadata.backdrop_path) {
        assetTasks.push(
          ingestAsset({
            id: String(tmdbMetadata.tmdb_id),
            url: tmdbProvider.getAssetUrl(tmdbMetadata.backdrop_path, "backdrop"),
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
          const localPoster = getLocalAssetPaths(tmdbMetadata.tmdb_id, "poster");
          const localBackdrop = getLocalAssetPaths(tmdbMetadata.tmdb_id, "backdrop");

          const isTv = tmdbMetadata._type === "tv";

          const enrichmentData: NewEnrichment = {
            torrentInfoHash: infoHash,
            tmdbId: tmdbMetadata.tmdb_id,
            imdbId: tmdbMetadata.imdb_id,
            tvdbId: isTv ? tmdbMetadata.tvdb_id : null,
            mediaType: torrentType || "movie",
            overview: tmdbMetadata.overview,
            tagline: tmdbMetadata.tagline,
            releaseDate: new Date(tmdbMetadata.release_date),
            year: tmdbMetadata.release_year,
            runtime: tmdbMetadata.runtime || 0,
            status: isTv ? tmdbMetadata.status : "Released",
            genres: tmdbMetadata.genres,
            posterUrl: tmdbMetadata.poster_path ? localPoster.relative : null,
            backdropUrl: tmdbMetadata.backdrop_path ? localBackdrop.relative : null,
            totalSeasons: isTv ? tmdbMetadata.number_of_seasons : null,
            totalEpisodes: isTv ? tmdbMetadata.number_of_episodes : null,
            anilistId: null,
            malId: null,
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
      const enrichedDoc = formatTorrentForMeilisearch(enriched);
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
