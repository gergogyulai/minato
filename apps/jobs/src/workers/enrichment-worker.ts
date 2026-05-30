import { db, enrichments, eq, torrents } from "@project-minato/db";
import { env } from "@project-minato/env/jobs";
import {
	formatTorrentForMeilisearch,
	MeiliBatcher,
} from "@project-minato/meilisearch";
import { connection, ENRICH_JOBS, QUEUES } from "@project-minato/queue";
import { type Job, Worker } from "bullmq";
import { type MapperContext, mapMetadata } from "@/lib/metadata/mappers/index";
import { AniListProvider } from "@/lib/metadata/providers/anilist";
import { TMDBProvider } from "@/lib/metadata/providers/tmdb";
import { ProviderRegistry } from "@/lib/metadata/registry";
import type { MediaType } from "@/lib/metadata/types";
import { getAssetId } from "@/lib/metadata/utils";
import { tmdbRateLimiter } from "@/rate-limiter";
import { markAsEnriched } from "@/utils/enrich";
import { logger } from "@/utils/logger";
import { getLocalAssetPaths, ingestAsset } from "@/utils/media";
import { withTimeout } from "@/utils/with-timeout";

const log = logger.child({ worker: "enrichment" });

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
				log.debug({ jobId: job.id, infoHash, isRefresh }, "Processing job");

				const [torrent] = await db
					.select()
					.from(torrents)
					.where(eq(torrents.infoHash, infoHash))
					.limit(1);

				if (!torrent) {
					log.warn({ infoHash }, "Torrent not found");
					return;
				}

				if (torrent.enrichedAt && !isRefresh) {
					log.debug({ infoHash }, "Already enriched, skipping");
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
					| MediaType
					| undefined;
				const cleanTitle = torrent.releaseData?.title;
				const year = Number(torrent.releaseData?.year);

				if (
					!torrentType ||
					providerRegistry.getProvidersForType(torrentType).length === 0
				) {
					log.debug({ infoHash, torrentType }, "Unsupported type, skipping");
					await markAsEnriched(infoHash);
					return;
				}

				if (!cleanTitle) {
					log.debug({ infoHash }, "No title available, skipping");
					await markAsEnriched(infoHash);
					return;
				}

				await tmdbRateLimiter.waitForToken();

				log.info(
					{ infoHash, cleanTitle, torrentType, year, isRefresh },
					"Enriching",
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
								log.warn(
									{ err, infoHash, provider: preferredName },
									"Provider failed, falling back",
								);
							}
						} else {
							log.warn(
								{ infoHash, provider: preferredName },
								"Provider not in registry, falling back",
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
					log.debug({ infoHash }, "No metadata found");
					await markAsEnriched(infoHash);
					return;
				}

				const { metadata, provider: providerInfo } = enrichedResult;
				log.info({ infoHash, provider: providerInfo.name }, "Metadata found");

				const assetId = getAssetId(metadata);

				const backdropPath =
					"backdropPath" in metadata ? metadata.backdropPath : null;
				const artworkPath =
					metadata.mediaType === "music"
						? metadata.albumCoverPath
						: metadata.posterPath;

				await Promise.allSettled(
					[
						artworkPath &&
							ingestAsset({
								id: assetId,
								url:
									providerRegistry.getAssetUrl(
										providerInfo.name,
										artworkPath,
										"poster",
									) || artworkPath,
								type: "poster",
							}),
						backdropPath &&
							ingestAsset({
								id: assetId,
								url:
									providerRegistry.getAssetUrl(
										providerInfo.name,
										backdropPath,
										"backdrop",
									) || backdropPath,
								type: "backdrop",
							}),
					].filter(Boolean),
				);

				const localPoster = getLocalAssetPaths(assetId, "poster");
				const localBackdrop = getLocalAssetPaths(assetId, "backdrop");

				const ctx: MapperContext = {
					infoHash,
					providerName: providerInfo.name,
					posterUrl: artworkPath ? localPoster.relative : null,
					backdropUrl: backdropPath ? localBackdrop.relative : null,
					episodeNumber: torrent.releaseData?.episode ?? null,
					seasonNumber: torrent.releaseData?.season ?? null,
				};
				const enrichmentData = mapMetadata(metadata, ctx);

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
					log.warn({ infoHash }, "Enrichment write returned nothing");
					return;
				}

				await markAsEnriched(infoHash);

				const enriched = await db.query.torrents.findFirst({
					where: eq(torrents.infoHash, infoHash),
					with: { enrichment: true },
				});

				if (enriched) {
					await meiliBatcher.add(formatTorrentForMeilisearch(enriched));
					log.debug({ infoHash }, "Meilisearch updated");
				}
			}, JOB_TIMEOUT_MS),
		{
			connection,
			concurrency: 75,
			lockDuration: JOB_TIMEOUT_MS,
		},
	);

	worker.on("completed", (job) => {
		log.debug({ jobId: job.id }, "Job completed");
	});

	worker.on("failed", (job, err) => {
		log.error({ jobId: job?.id, err }, "Job failed");
	});

	worker.on("closing", async () => {
		log.info("Worker closing, flushing batch...");
		await meiliBatcher.flush();
	});

	return worker;
}
