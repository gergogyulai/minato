import { Worker, Job } from "bullmq";
import { connection, enrichQueue, QUEUES } from "@project-minato/queue";
import { db, torrents, eq } from "@project-minato/db";
import {
  formatTorrentForMeilisearch,
  MeiliBatcher,
} from "@project-minato/meilisearch";
import ReleaseParser from "release-parser";

interface IngestJobData {
  infoHash: string;
}

const INGEST_BATCH_SIZE = 50;
const INGEST_BATCH_TIMEOUT = 3000; // 3 seconds

export function startIngestWorker() {
  const meiliBatcher = new MeiliBatcher(
    "torrents",
    INGEST_BATCH_SIZE,
    INGEST_BATCH_TIMEOUT,
  );

  const worker = new Worker<IngestJobData>(
    QUEUES.INGEST,
    async (job: Job<IngestJobData>) => {
      console.log(
        `[Ingest Worker] Processing job ${job.id} for torrent ${job.data.infoHash}`,
      );

      const { infoHash } = job.data;

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

      const torrentDoc = formatTorrentForMeilisearch(updatedTorrent);
      await meiliBatcher.add(torrentDoc);

      console.log(
        `[Ingest Worker] Document queued for torrent ${infoHash} - Title: ${
          updatedTorrent.releaseTitle || updatedTorrent.trackerTitle
        }`,
      );

      // Check for enrichment eligibility
      if (
        (updatedTorrent.type === "Movie" || updatedTorrent.type === "TV") &&
        !updatedTorrent.enrichedAt
      ) {
        console.log(
          `[Ingest Worker] Torrent ${infoHash} is enrichable, queuing for enrichment`,
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

  worker.on("closing", async () => {
    console.log("[Ingest Worker] Worker closing, flushing remaining batch...");
    await meiliBatcher.flush();
  });

  console.log("[Ingest Worker] Started and listening for jobs...");

  return worker;
}