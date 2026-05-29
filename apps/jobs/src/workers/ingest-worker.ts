import { db, eq, torrents } from "@project-minato/db";
import {
	formatTorrentForMeilisearch,
	MeiliBatcher,
} from "@project-minato/meilisearch";
import { connection, enrichQueue, QUEUES } from "@project-minato/queue";
import { type Job, Worker } from "bullmq";
import ReleaseParser from "release-parser";
import { logger } from "@/utils/logger";

const log = logger.child({ worker: "ingest" });

interface IngestJobData {
	infoHash: string;
}

const INGEST_BATCH_SIZE = 500;
const INGEST_BATCH_TIMEOUT = 5000;

export function startIngestWorker() {
	const meiliBatcher = new MeiliBatcher(
		"torrents",
		INGEST_BATCH_SIZE,
		INGEST_BATCH_TIMEOUT,
	);

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

			await db
				.update(torrents)
				.set({
					releaseData: release.data,
					type: release.data.type ?? null,
					indexedAt: new Date(),
					isDirty: false,
				})
				.where(eq(torrents.infoHash, infoHash));

			const [updatedTorrent] = await db
				.select()
				.from(torrents)
				.where(eq(torrents.infoHash, infoHash))
				.limit(1);

			if (!updatedTorrent) {
				log.warn({ infoHash }, "Updated torrent not found");
				return;
			}

			const torrentDoc = formatTorrentForMeilisearch(updatedTorrent);
			await meiliBatcher.add(torrentDoc);

			log.debug(
				{
					infoHash,
					title:
						updatedTorrent.releaseData?.title ?? updatedTorrent.trackerTitle,
				},
				"Document queued",
			);

			if (
				(updatedTorrent.releaseData?.type === "Movie" ||
					updatedTorrent.releaseData?.type === "TV" ||
					updatedTorrent.releaseData?.type === "Anime") &&
				!updatedTorrent.enrichedAt
			) {
				log.debug({ infoHash }, "Queuing for enrichment");
				await enrichQueue.add("enrich", { infoHash }, { delay: 1000 });
			}
		},
		{ connection, concurrency: 25 },
	);

	worker.on("completed", (job) => {
		log.debug({ jobId: job.id }, "Job completed");
	});

	worker.on("failed", (job, err) => {
		log.error({ jobId: job?.id, err }, "Job failed");
	});

	worker.on("closing", async () => {
		log.info("Worker closing, flushing remaining batch...");
		await meiliBatcher.flush();
	});

	return worker;
}
