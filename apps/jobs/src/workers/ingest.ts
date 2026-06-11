import {
	db,
	getTableColumns,
	inArray,
	sql,
	torrents,
} from "@project-minato/db";
import {
	formatTorrentForMeilisearch,
	meiliClient,
} from "@project-minato/meilisearch";
import {
	aiRepairQueue,
	connection,
	enrichQueue,
	type IngestJobData,
	QUEUES,
} from "@project-minato/queue";
import { Batcher } from "@project-minato/utils/batcher";
import { logger } from "@project-minato/utils/logger";
import { type Job, Worker } from "bullmq";
import ReleaseParser from "release-parser";
import { getReleaseConfidence } from "@/lib/repair/confidence";

const log = logger.child({ worker: "ingest" });

const INGEST_BATCH_SIZE = 500;
const INGEST_BATCH_TIMEOUT = 5000;

export function startIngestWorker() {
	const meiliBatcher = new Batcher<
		ReturnType<typeof formatTorrentForMeilisearch>
	>({
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
			const { infoHashes } = job.data;
			log.debug({ jobId: job.id, count: infoHashes.length }, "Processing job");

			if (infoHashes.length === 0) return;

			const rows = await db
				.select({
					infoHash: torrents.infoHash,
					trackerTitle: torrents.trackerTitle,
				})
				.from(torrents)
				.where(inArray(torrents.infoHash, infoHashes));

			if (rows.length < infoHashes.length) {
				log.warn(
					{ missing: infoHashes.length - rows.length },
					"Some torrents not found",
				);
			}

			const parsed: {
				infoHash: string;
				release: ReturnType<typeof ReleaseParser>;
			}[] = [];
			for (const row of rows) {
				try {
					parsed.push({
						infoHash: row.infoHash,
						release: ReleaseParser(row.trackerTitle),
					});
				} catch (err) {
					log.error({ err, infoHash: row.infoHash }, "Release parsing failed");
				}
			}

			if (parsed.length === 0) return;

			const valuesSql = sql.join(
				parsed.map(
					(p) =>
						sql`(${p.infoHash}, ${JSON.stringify(p.release.data)}::jsonb, ${p.release.data.type ?? null}::text)`,
				),
				sql`, `,
			);

			const updated = await db
				.update(torrents)
				.set({
					releaseData: sql`v.release_data`,
					type: sql`v.type`,
					indexedAt: new Date(),
					isDirty: false,
				})
				.from(sql`(values ${valuesSql}) as v(info_hash, release_data, type)`)
				.where(sql`${torrents.infoHash} = v.info_hash`)
				// explicit columns: with a raw SQL `from`, drizzle cannot infer the
				// all-columns returning type and collapses it to `never`
				.returning(getTableColumns(torrents));

			const releaseByHash = new Map(parsed.map((p) => [p.infoHash, p.release]));
			const repairs: string[] = [];

			for (const torrent of updated) {
				meiliBatcher.add(formatTorrentForMeilisearch(torrent));

				const release = releaseByHash.get(torrent.infoHash);
				if (!release) continue;

				if (getReleaseConfidence(release.data) === "low") {
					repairs.push(torrent.infoHash);
				} else if (
					(torrent.releaseData?.type === "Movie" ||
						torrent.releaseData?.type === "TV" ||
						torrent.releaseData?.type === "Anime") &&
					!torrent.enrichedAt
				) {
					enrichBatcher.add(torrent.infoHash);
				}
			}

			if (repairs.length > 0) {
				log.debug(
					{ count: repairs.length },
					"Low confidence — queuing for AI repair",
				);
				await aiRepairQueue.addBulk(
					repairs.map((infoHash) => ({
						name: "repair",
						data: { infoHash },
					})),
				);
			}

			log.debug(
				{ jobId: job.id, updated: updated.length, repairs: repairs.length },
				"Batch processed",
			);
		},
		{ connection, concurrency: 12 },
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
