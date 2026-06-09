import { db, eq, torrents } from "@project-minato/db";
import {
	formatTorrentForMeilisearch,
	meiliClient,
} from "@project-minato/meilisearch";
import { aiRepairQueue, connection, enrichQueue, QUEUES } from "@project-minato/queue";
import { Batcher } from "@project-minato/utils/batcher";
import { type Job, Worker } from "bullmq";
import ReleaseParser from "release-parser";
import { getReleaseConfidence } from "@/lib/repair/confidence";
import { logger } from "@project-minato/utils/logger";

const log = logger.child({ worker: "ingest" });

interface IngestJobData {
	infoHash: string;
}

const INGEST_BATCH_SIZE = 500;
const INGEST_BATCH_TIMEOUT = 5000;

export function startIngestWorker() {
	const meiliBatcher = new Batcher<ReturnType<typeof formatTorrentForMeilisearch>>({
		maxSize: INGEST_BATCH_SIZE,
		maxWaitMs: INGEST_BATCH_TIMEOUT,
		onFlush: async (batch) => {
			await meiliClient
				.index("torrents")
				.addDocuments(batch, { primaryKey: "infoHash" });
		},
		onError: (err, failedBatch) => {
			log.error({ err, count: failedBatch.length }, "Meilisearch batch failed");
		},
	});

	const enrichBatcher = new Batcher<string>({
		maxSize: 100,
		maxWaitMs: 2000,
		onFlush: async (batch) => {
			await enrichQueue.addBulk(
				batch.map((infoHash) => ({
					name: "enrich",
					data: { infoHash },
					opts: { delay: 1000 },
				})),
			);
		},
	});

	const worker = new Worker<IngestJobData>(
		QUEUES.INGEST,
		async (job: Job<IngestJobData>) => {
			const { infoHash } = job.data;
			log.debug({ jobId: job.id, infoHash }, "Processing job");

			const [torrent] = await db
				.select()
				.from(torrents)
				.where(eq(torrents.infoHash, infoHash))
				.limit(1);

			if (!torrent) {
				log.warn({ infoHash }, "Torrent not found");
				return;
			}

			let release;
			try {
				release = ReleaseParser(torrent.trackerTitle);
			} catch (err) {
				log.error({ err, infoHash }, "Release parsing failed");
				return;
			}

			const [updatedTorrent] = await db
				.update(torrents)
				.set({
					releaseData: release.data,
					type: release.data.type ?? null,
					indexedAt: new Date(),
					isDirty: false,
				})
				.where(eq(torrents.infoHash, infoHash))
				.returning();

			if (!updatedTorrent) {
				log.warn({ infoHash }, "Updated torrent not found");
				return;
			}

			await meiliBatcher.add(formatTorrentForMeilisearch(updatedTorrent));

			log.debug(
				{
					infoHash,
					title:
						updatedTorrent.releaseData?.title ?? updatedTorrent.trackerTitle,
				},
				"Document queued",
			);

			const confidence = getReleaseConfidence(release.data);

			if (confidence === "low") {
				log.debug({ infoHash }, "Low confidence — queuing for AI repair");
				await aiRepairQueue.add("repair", { infoHash });
			} else if (
				(updatedTorrent.releaseData?.type === "Movie" ||
					updatedTorrent.releaseData?.type === "TV" ||
					updatedTorrent.releaseData?.type === "Anime") &&
				!updatedTorrent.enrichedAt
			) {
				log.debug({ infoHash }, "Queuing for enrichment");
				await enrichBatcher.add(infoHash);
			}
		},
		{ connection, concurrency: 128 },
	);

	worker.on("completed", (job) => {
		log.debug({ jobId: job.id }, "Job completed");
	});

	worker.on("failed", (job, err) => {
		log.error({ jobId: job?.id, err }, "Job failed");
	});

	worker.on("closing", async () => {
		log.info("Worker closing, flushing remaining batch...");
		await Promise.all([meiliBatcher.flush(), enrichBatcher.flush()]);
	});

	return worker;
}
