import { Worker, Job } from "bullmq";
import { connection, enrichQueue, QUEUES } from "@project-minato/queue";
import { db, torrents, eq } from "@project-minato/db";
import { meiliClient, formatTorrentForMeilisearch } from "@project-minato/meilisearch";
import ReleaseParser from "release-parser";

interface IngestJobData {
  infoHash: string;
}

const BATCH_SIZE = 50;
const BATCH_TIMEOUT = 3000; // 3 seconds

export function startIngestWorker() {
  let batchBuffer: any[] = [];
  let flushTimer: NodeJS.Timeout | null = null;

  const flushBatch = async () => {
    if (batchBuffer.length === 0) return;

    const toIndex = [...batchBuffer];
    batchBuffer = [];

    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }

    try {
      console.log(
        `[Ingest Worker] Flushing ${toIndex.length} torrents to Meilisearch`,
      );
      await meiliClient
        .index("torrents")
        .addDocuments(toIndex, { primaryKey: "infoHash" });
      console.log(
        `[Ingest Worker] Successfully indexed ${toIndex.length} torrents`,
      );
    } catch (error) {
      console.error(
        `[Ingest Worker] Meilisearch batch indexing failed:`,
        error,
      );
    }
  };

  const scheduleBatchFlush = () => {
    if (flushTimer) return;
    flushTimer = setTimeout(() => {
      flushBatch();
    }, BATCH_TIMEOUT);
  };

  const worker = new Worker<IngestJobData>(
    QUEUES.INGEST,
    async (job: Job<IngestJobData>) => {
      console.log(
        `[Ingest Worker] Processing job ${job.id} for torrent ${job.data.infoHash}`,
      );

      const { infoHash } = job.data;

      // Fetch torrent from database
      const [torrent] = await db
        .select()
        .from(torrents)
        .where(eq(torrents.infoHash, infoHash))
        .limit(1);

      if (!torrent) {
        console.error(`[Ingest Worker] Torrent not found: ${infoHash}`);
        return;
      }

      let release;
      try {
        release = ReleaseParser(torrent.trackerTitle);
      } catch (error) {
        console.error(
          `[Ingest Worker] Release parsing failed for torrent ${infoHash}:`,
          error,
        );
        return;
      }

      await db
        .update(torrents)
        .set({
          releaseData: release.data,
          type: release.data.type,
          group: release.data.group,
          resolution: release.data.resolution,
          releaseTitle: release.data.title,
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
        console.error(`[Ingest Worker] Updated torrent not found: ${infoHash}`);
        return;
      }

      // Add to batch buffer - format for Meilisearch
      const torrentDoc = formatTorrentForMeilisearch(updatedTorrent);
      batchBuffer.push(torrentDoc);
      console.log(
        `[Ingest Worker] Added torrent ${infoHash} to batch (${batchBuffer.length}/${BATCH_SIZE}) - Title: ${updatedTorrent.releaseTitle || updatedTorrent.trackerTitle}`,
      );

      // Flush if batch is full
      if (batchBuffer.length >= BATCH_SIZE) {
        await flushBatch();
      } else {
        scheduleBatchFlush();
      }

      if (
        (updatedTorrent.type == "Movie" || updatedTorrent.type == "TV") &&
        !updatedTorrent.enrichedAt
      ) {
        console.log(
          `[Ingest Worker] Torrent ${infoHash} - Title: ${updatedTorrent.releaseTitle || updatedTorrent.trackerTitle} is enrichable, queuing for enrichment`,
        );

        await enrichQueue.add("enrich", { infoHash }, { delay: 1000 });
      }
    },
    { connection },
  );

  worker.on("completed", (job) => {
    console.log(`[Ingest Worker] Job ${job.id} completed`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[Ingest Worker] Job ${job?.id} failed:`, err);
  });

  // Flush batch on worker close
  worker.on("closing", async () => {
    console.log("[Ingest Worker] Worker closing, flushing remaining batch...");
    await flushBatch();
  });

  console.log("[Ingest Worker] Started and listening for jobs...");

  return worker;
}
