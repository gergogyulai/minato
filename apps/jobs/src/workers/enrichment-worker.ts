import { db, enrichments, eq, torrents } from "@project-minato/db";
import { env } from "@project-minato/env/jobs";
import {
	formatTorrentForMeilisearch,
	meiliClient,
} from "@project-minato/meilisearch";
import { connection, ENRICH_JOBS, QUEUES } from "@project-minato/queue";
import { Batcher } from "@project-minato/utils/batcher";
import { type Job, Worker } from "bullmq";
import { downloadAssets } from "@/lib/metadata/assets";
import { type MapperContext, mapMetadata } from "@/lib/metadata/mappers/index";
import { AniListProvider } from "@/lib/metadata/providers/anilist";
import { TMDBProvider } from "@/lib/metadata/providers/tmdb";
import { MetadataResolver } from "@/lib/metadata/resolver";
import type { MediaType } from "@/lib/metadata/types";
import { tmdbRateLimiter } from "@/rate-limiter";
import type { EnrichJobData } from "@/types/enrich";
import { markAsEnriched } from "@/utils/enrich";
import { logger } from "@/utils/logger";
import { withTimeout } from "@/utils/with-timeout";

const log = logger.child({ worker: "enrichment" });

const resolver = new MetadataResolver([
	{ provider: new TMDBProvider({ apiKey: env.TMDB_READ_ACCESS_TOKEN }), priority: 1 },
	{ provider: new AniListProvider(), priority: 2 },
]);

const ENRICH_BATCH_SIZE = 50;
const ENRICH_BATCH_TIMEOUT = 30_000;
const JOB_TIMEOUT_MS = 60_000;

export function startEnrichmentWorker() {
	const meiliBatcher = new Batcher<ReturnType<typeof formatTorrentForMeilisearch>>({
		maxSize: ENRICH_BATCH_SIZE,
		maxWaitMs: ENRICH_BATCH_TIMEOUT,
		onFlush: async (batch) => {
			await meiliClient.index("torrents").addDocuments(batch, { primaryKey: "infoHash" });
		},
		onError: (err, failedBatch) => {
			log.error({ err, count: failedBatch.length }, "Meilisearch batch failed");
		},
	});

	const worker = new Worker<EnrichJobData>(
		QUEUES.ENRICH,
		(job) => withTimeout(() => processEnrichJob(job, meiliBatcher), JOB_TIMEOUT_MS),
		{ connection, concurrency: 75, lockDuration: JOB_TIMEOUT_MS },
	);

	worker.on("completed", (job) => log.debug({ jobId: job.id }, "Job completed"));
	worker.on("failed", (job, err) => log.error({ jobId: job?.id, err }, "Job failed"));
	worker.on("closing", async () => {
		log.info("Worker closing, flushing batch...");
		await meiliBatcher.flush();
	});

	return worker;
}

async function processEnrichJob(
	job: Job<EnrichJobData>,
	batcher: Batcher<ReturnType<typeof formatTorrentForMeilisearch>>,
) {
	const { infoHash } = job.data;
	const isRefresh = job.name === ENRICH_JOBS.REFRESH;
	log.debug({ jobId: job.id, infoHash, isRefresh }, "Processing job");

	const [torrent] = await db.select().from(torrents).where(eq(torrents.infoHash, infoHash)).limit(1);
	if (!torrent) {
		log.warn({ infoHash }, "Torrent not found");
		job.log("Torrent not found, skipping");
		return;
	}

	if (torrent.enrichedAt && !isRefresh) {
		log.debug({ infoHash }, "Already enriched, skipping");
		job.log("Already enriched, skipping");
		return;
	}

	const type = torrent.releaseData?.type?.toLowerCase() as MediaType | undefined;
	const title = torrent.releaseData?.title;
	const year = Number(torrent.releaseData?.year) || undefined;

	if (!type) {
		log.debug({ infoHash }, "No type available, skipping");
		job.log("No type available, skipping");
		await markAsEnriched(infoHash);
		return;
	}

	if (!title) {
		log.debug({ infoHash }, "No title available, skipping");
		job.log("No title available, skipping");
		await markAsEnriched(infoHash);
		return;
	}

	await tmdbRateLimiter.waitForToken();
	log.info({ infoHash, title, type, year, isRefresh }, "Enriching");

	const preferredProvider = isRefresh
		? (job.data.provider ?? (await db.query.enrichments.findFirst({
				where: eq(enrichments.torrentInfoHash, infoHash),
			}))?.provider ?? null)
		: null;

	const result = await resolver.find(title, year ?? null, type, preferredProvider);

	if (!result) {
		log.debug({ infoHash }, "No metadata found");
		await markAsEnriched(infoHash);
		return;
	}

	const { metadata, providerName } = result;
	log.info({ infoHash, provider: providerName }, "Metadata found");

	const assetUrls = await downloadAssets(metadata, providerName, resolver);

	const ctx: MapperContext = {
		infoHash,
		providerName,
		posterUrl: assetUrls.posterUrl,
		backdropUrl: assetUrls.backdropUrl,
		episodeNumber: torrent.releaseData?.episode ?? null,
		seasonNumber: torrent.releaseData?.season ?? null,
	};
	const enrichmentData = mapMetadata(metadata, ctx);

	const { finalEnrichment, enrichedTorrent } = await db.transaction(async (tx) => {
		const [upserted] = await tx
			.insert(enrichments)
			.values(enrichmentData)
			.onConflictDoUpdate({ target: enrichments.torrentInfoHash, set: enrichmentData })
			.returning();

		const [updated] = await tx
			.update(torrents)
			.set({ enrichedAt: new Date(), isDirty: false })
			.where(eq(torrents.infoHash, infoHash))
			.returning();

		return { finalEnrichment: upserted, enrichedTorrent: updated };
	});

	if (!finalEnrichment || !enrichedTorrent) {
		log.warn({ infoHash }, "Transaction returned no rows, skipping index update");
		return;
	}

	await batcher.add(formatTorrentForMeilisearch({ ...enrichedTorrent, enrichment: finalEnrichment }));

	job.log("Enrichment complete");
	log.debug({ infoHash }, "Enrichment complete");
}
