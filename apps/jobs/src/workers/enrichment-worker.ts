import { Worker, Job } from "bullmq";
import { connection, QUEUES, ENRICH_JOBS } from "@project-minato/queue";
import {
  db,
  torrents,
  eq,
  enrichments,
  type NewEnrichment,
} from "@project-minato/db";
import { tmdbRateLimiter } from "@/rate-limiter";
import {
  formatTorrentForMeilisearch,
  MeiliBatcher,
} from "@project-minato/meilisearch";
import { getLocalAssetPaths, ingestAsset } from "@/utils/media";
import { TMDBProvider } from "@/lib/providers/tmdb";
import { AniListProvider } from "@/lib/providers/anilist";
import { ProviderRegistry } from "@/lib/providers/registry";
import { getAssetId } from "@/lib/providers/types/metadata";
import { markAsEnriched } from "@/utils/enrich";
import { withTimeout } from "@/utils/with-timeout";
import { env } from "@project-minato/env/jobs";

const tmdbProvider = new TMDBProvider({
  apiKey: env.TMDB_READ_ACCESS_TOKEN,
});

const anilistProvider = new AniListProvider();

const providerRegistry = new ProviderRegistry({
  providers: [
    { provider: tmdbProvider, priority: 1, enabled: true },
    { provider: anilistProvider, priority: 2, enabled: true },
  ],
});

interface EnrichJobData {
  infoHash: string;
  provider?: string;
}

const ENRICH_BATCH_SIZE = 50;
const ENRICH_BATCH_TIMEOUT = 30000; // 30 seconds
const JOB_TIMEOUT_MS = 60000; // 60 seconds fail-safe for the worker

export function startEnrichmentWorker() {
  const meiliBatcher = new MeiliBatcher(
    "torrents",
    ENRICH_BATCH_SIZE,
    ENRICH_BATCH_TIMEOUT,
  );

  const worker = new Worker<EnrichJobData>(
    QUEUES.ENRICH,
    (job: Job<EnrichJobData>) =>
      withTimeout(async () => {
        const { infoHash } = job.data;
        const isRefresh = job.name === ENRICH_JOBS.REFRESH;
        console.log(
          `[Enrichment Worker] Processing job ${job.id} (${isRefresh ? "refresh" : "enrich"}) for ${infoHash}`,
        );

        const [torrent] = await db
          .select()
          .from(torrents)
          .where(eq(torrents.infoHash, infoHash))
          .limit(1);

        if (!torrent) {
          console.error(`[Enrichment Worker] Torrent not found: ${infoHash}`);
          return;
        }

        if (torrent.enrichedAt && !isRefresh) {
          console.log(
            `[Enrichment Worker] ${infoHash} already enriched, skipping`,
          );
          return;
        }

        // Fetch existing enrichment once — used for provider resolution on refresh
        // and reused inside the transaction to avoid a second round-trip.
        const existingEnrichment = isRefresh
          ? await db.query.enrichments.findFirst({
              where: eq(enrichments.torrentInfoHash, infoHash),
            })
          : undefined;

        const torrentType = torrent.releaseData?.type?.toLowerCase() as
          | "movie"
          | "tv"
          | "anime";
        const cleanTitle = torrent.releaseData?.title;
        const year = Number(torrent.releaseData?.year);

        if (
          !torrentType ||
          providerRegistry.getProvidersForType(torrentType).length === 0
        ) {
          console.log(
            `[Enrichment Worker] ${infoHash}: unsupported type "${torrentType}", skipping`,
          );
          await markAsEnriched(infoHash);
          return;
        }

        if (!cleanTitle) {
          console.log(
            `[Enrichment Worker] ${infoHash}: no title available, skipping`,
          );
          await markAsEnriched(infoHash);
          return;
        }

        await tmdbRateLimiter.waitForToken();

        console.log(
          `[Enrichment Worker] ${isRefresh ? "Refreshing" : "Enriching"} ${infoHash}: "${cleanTitle}" (${torrentType}, ${year})`,
        );

        // On refresh, prefer the original provider (or an explicit job override).
        // Fall back to the full provider chain if needed.
        let enrichedResult = null;

        if (isRefresh) {
          const preferredName =
            job.data.provider ?? existingEnrichment?.provider ?? null;
          if (preferredName) {
            const preferred = providerRegistry.getProvider(preferredName);
            if (preferred) {
              try {
                const metadata = await preferred.find(
                  cleanTitle,
                  year || undefined,
                  torrentType,
                );
                if (metadata) {
                  enrichedResult = {
                    metadata,
                    provider: { name: preferred.name, priority: 0 },
                  };
                }
              } catch (err) {
                console.error(
                  `[Enrichment Worker] Provider "${preferredName}" failed for ${infoHash}, falling back:`,
                  err,
                );
              }
            } else {
              console.warn(
                `[Enrichment Worker] Provider "${preferredName}" not in registry, falling back`,
              );
            }
          }
        }

        if (!enrichedResult) {
          enrichedResult = await providerRegistry.findWithFallback(
            cleanTitle,
            year,
            torrentType,
          );
        }

        if (!enrichedResult) {
          console.log(`[Enrichment Worker] No metadata found for ${infoHash}`);
          await markAsEnriched(infoHash);
          return;
        }

        const { metadata, provider: providerInfo } = enrichedResult;
        console.log(
          `[Enrichment Worker] ${infoHash}: metadata found via "${providerInfo.name}"`,
        );

        const assetId = getAssetId(metadata);

        await Promise.allSettled(
          [
            metadata.posterPath &&
              ingestAsset({
                id: assetId,
                url:
                  providerRegistry.getAssetUrl(
                    providerInfo.name,
                    metadata.posterPath,
                    "poster",
                  ) || metadata.posterPath,
                type: "poster",
              }),
            metadata.backdropPath &&
              ingestAsset({
                id: assetId,
                url:
                  providerRegistry.getAssetUrl(
                    providerInfo.name,
                    metadata.backdropPath,
                    "backdrop",
                  ) || metadata.backdropPath,
                type: "backdrop",
              }),
          ].filter(Boolean),
        );

        const localPoster = getLocalAssetPaths(assetId, "poster");
        const localBackdrop = getLocalAssetPaths(assetId, "backdrop");

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
          provider: providerInfo.name,
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

        // Upsert on refresh, plain insert otherwise (guarded by the existingEnrichment check).
        // markAsEnriched runs outside the transaction to avoid connection pool deadlocks.
        const finalEnrichment = await db.transaction(async (tx) => {
          if (!existingEnrichment || isRefresh) {
            const [upserted] = await tx
              .insert(enrichments)
              .values(enrichmentData)
              .onConflictDoUpdate({
                target: enrichments.torrentInfoHash,
                set: enrichmentData,
              })
              .returning();
            return upserted;
          }
          return existingEnrichment;
        });

        if (!finalEnrichment) {
          console.log(
            `[Enrichment Worker] ${infoHash}: enrichment write returned nothing`,
          );
          return;
        }

        await markAsEnriched(infoHash);

        const enriched = await db.query.torrents.findFirst({
          where: eq(torrents.infoHash, infoHash),
          with: { enrichment: true },
        });

        if (enriched) {
          await meiliBatcher.add(formatTorrentForMeilisearch(enriched));
          console.log(`[Enrichment Worker] ${infoHash}: Meilisearch updated`);
        }
      }, JOB_TIMEOUT_MS),
    {
      connection,
      concurrency: 75,
      lockDuration: JOB_TIMEOUT_MS,
    },
  );

  worker.on("completed", (job) => {
    console.log(`[Enrichment Worker] Job ${job.id} completed`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[Enrichment Worker] Job ${job?.id} failed:`, err);
  });

  worker.on("closing", async () => {
    console.log("[Enrichment Worker] Closing, flushing batch...");
    await meiliBatcher.flush();
  });

  return worker;
}
