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
import { formatTorrentForMeilisearch, MeiliBatcher } from "@project-minato/meilisearch";
import { getLocalAssetPaths, ingestAsset } from "../utils/media";
import { TMDBProvider } from "../lib/providers/tmdb";
import { AniListProvider } from "../lib/providers/anilist";
import { ProviderRegistry } from "../lib/providers/registry";
import { getAssetId } from "../lib/providers/types/metadata";
import { markAsEnriched } from "../utils/enrich";

const tmdbProvider = new TMDBProvider({
  apiKey: process.env.TMDB_READ_ACCESS_TOKEN!,
});

const anilistProvider = new AniListProvider({});

const providerRegistry = new ProviderRegistry({
  providers: [
    { provider: tmdbProvider, priority: 1, enabled: true },
    { provider: anilistProvider, priority: 2, enabled: true },
  ],
});

interface EnrichJobData {
  infoHash: string;
}

const ENRICH_BATCH_SIZE = 50;
const ENRICH_BATCH_TIMEOUT = 3000; // 3 seconds

export function startEnrichmentWorker() {
  const meiliBatcher = new MeiliBatcher(
    "torrents",
    ENRICH_BATCH_SIZE,
    ENRICH_BATCH_TIMEOUT,
  );
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

      // Rate limit before calling TMDB (or any provider)
      await tmdbRateLimiter.waitForToken();
      const year = Number(torrent.releaseData?.year) || null;
      const cleanTitle = torrent.releaseData?.title;
      const torrentType = torrent.type?.toLowerCase() as "movie" | "tv" | "anime";

      // Check if any provider supports this type
      const supportedProviders = torrentType 
        ? providerRegistry.getProvidersForType(torrentType)
        : [];

      if (!torrentType || supportedProviders.length === 0) {
        console.log(
          `[Enrichment Worker] Torrent ${infoHash} has unsupported type "${torrent.type}" or no providers available, skipping enrichment`,
        );
        // Still mark as enriched to avoid retrying
        await markAsEnriched(infoHash);
        return;
      }

      if (!cleanTitle || !year) {
        console.log(
          `[Enrichment Worker] Torrent ${infoHash} has no valid title or year for enrichment`,
        );
        // Still mark as enriched to avoid retrying
        await markAsEnriched(infoHash);
        return;
      }
      
      // Use provider registry with automatic fallback
      const enrichedResult = await providerRegistry.findWithFallback(
        cleanTitle,
        year,
        torrentType,
      );

      if (!enrichedResult) {
        console.log(
          `[Enrichment Worker] No metadata found for torrent ${infoHash} from any provider`,
        );
        // Still mark as enriched to avoid retrying
        await markAsEnriched(infoHash);
        return;
      }

      const { metadata, provider: providerInfo } = enrichedResult;
      console.log(
        `[Enrichment Worker] Found metadata for ${infoHash} using provider "${providerInfo.name}"`,
      );

      const assetTasks = [];
      
      // Get the provider-specific ID for asset storage
      const assetId = getAssetId(metadata);
      
      if (metadata.posterPath) {
        const posterUrl = providerRegistry.getAssetUrl(
          providerInfo.name,
          metadata.posterPath,
          "poster"
        ) || metadata.posterPath; // Fallback to raw path if getAssetUrl not available
        
        assetTasks.push(
          ingestAsset({
            id: assetId,
            url: posterUrl,
            type: "poster",
          }),
        );
      }
      if (metadata.backdropPath) {
        const backdropUrl = providerRegistry.getAssetUrl(
          providerInfo.name,
          metadata.backdropPath,
          "backdrop"
        ) || metadata.backdropPath; // Fallback to raw path if getAssetUrl not available
        
        assetTasks.push(
          ingestAsset({
            id: assetId,
            url: backdropUrl,
            type: "backdrop",
          }),
        );
      }

      await Promise.allSettled(assetTasks);

      await db.transaction(async (tx) => {
        let enrichment = await tx.query.enrichments.findFirst({
          where: eq(enrichments.torrentInfoHash, infoHash),
        });

        if (!enrichment) {
          const localPoster = getLocalAssetPaths(assetId, "poster");
          const localBackdrop = getLocalAssetPaths(assetId, "backdrop");

          // Metadata is already enrichment-ready, just add local paths
          const enrichmentData: NewEnrichment = {
            torrentInfoHash: infoHash,
            mediaType: metadata.mediaType,
            tmdbId: metadata.tmdbId ?? null,
            imdbId: metadata.imdbId ?? null,
            tvdbId: metadata.tvdbId ?? null,
            anilistId: metadata.anilistId ?? null,
            malId: metadata.malId ?? null,
            title: metadata.title,
            overview: metadata.overview,
            tagline: metadata.tagline ?? null,
            releaseDate: new Date(metadata.releaseDate),
            year: metadata.releaseYear,
            runtime: metadata.runtime ?? 0,
            status: metadata.status ?? "Released",
            genres: metadata.genres,
            posterUrl: metadata.posterPath ? localPoster.relative : null,
            backdropUrl: metadata.backdropPath ? localBackdrop.relative : null,
            seriesDetails: {
              totalEpisodes: metadata.totalEpisodes ?? null,
              totalSeasons: metadata.totalSeasons ?? null,
              episodeNumber: torrent.releaseData?.episode ?? null,
              seasonNumber: torrent.releaseData?.season ?? null,
              episodeTitle: metadata.episodeTitle ?? null,
            },
            contentRating: metadata.contentRating ?? null,
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
        await markAsEnriched(infoHash);
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

      const enrichedDoc = formatTorrentForMeilisearch(enriched);
      await meiliBatcher.add(enrichedDoc);      
      console.log(
        `[Enrichment Worker] Updated torrent ${infoHash} in Meilisearch with enrichment data`,
      );
    },
    {
      connection,
      concurrency: 15,
    },
  );

  worker.on("completed", (job) => {
    console.log(`[Enrichment Worker] Job ${job.id} completed`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[Enrichment Worker] Job ${job?.id} failed:`, err);
  });

  worker.on("closing", async () => {
    console.log("[Enrichment Worker] Worker closing, flushing remaining batch...");
    await meiliBatcher.flush();
  });


  console.log("[Enrichment Worker] Started and listening for jobs...");

  return worker;
}
