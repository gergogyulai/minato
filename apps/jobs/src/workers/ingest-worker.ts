import { Worker, Job } from "bullmq";
import { connection, enrichQueue, QUEUES } from "@project-minato/queue";
import { db, torrents, eq } from "@project-minato/db";
import { meiliClient } from "@project-minato/meilisearch";
import ReleaseParser from "release-parser";

interface IngestJobData {
  infoHash: string;
}

export function startIngestWorker() {
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

      const release = ReleaseParser(torrent.trackerTitle);

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

      const mailiTask = await meiliClient
        .index("torrents")
        .addDocuments([updatedTorrent]);

      await job.updateProgress(mailiTask);
      // Update indexed_at in PostgreSQL
      await db
        .update(torrents)
        .set({ indexedAt: new Date() })
        .where(eq(torrents.infoHash, infoHash));

      console.log(
        `[Ingest Worker] Indexed torrent ${infoHash} - Title: ${updatedTorrent.releaseTitle || updatedTorrent.trackerTitle}`,
      );

      if ((updatedTorrent.type == "Movie" || updatedTorrent.type == "TV")  && !updatedTorrent.enrichedAt) {
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

  console.log("[Ingest Worker] Started and listening for jobs...");

  return worker;
}
