import { connection, QUEUES, enrichQueue } from "@project-minato/queue";
import { db, torrents } from "@project-minato/db";
import { eq } from "drizzle-orm";

import { type Job, Worker } from "bullmq";
import { logger } from "@/utils/logger";
import { generateMetadataFromRelease } from "@/lib/repair/generation";

const log = logger.child({ worker: "ai-repair-worker" });

interface AIRepairJobData {
  infoHash: string;
}

export function startAIRepairWorker() {
  return new Worker(
    QUEUES.AI_REPAIR,
    async (job: Job<AIRepairJobData>) => {
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

      if (!torrent.releaseData) {
        log.warn({ infoHash }, "No release data to repair");
        return;
      }
      const brokenReleaseDataString = JSON.stringify(torrent.releaseData);
      const repairedReleaseData = await generateMetadataFromRelease(
        brokenReleaseDataString,
        "deepseek/deepseek-v4-flash",
      );
      const repairedReleaseDataObj = JSON.parse(repairedReleaseData);

      log.info({ infoHash, repairedReleaseData }, "Repaired release data");

      await db
        .update(torrents)
        .set({
          releaseData: JSON.parse(repairedReleaseData),
          type: repairedReleaseDataObj.type ?? null,
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

      if (
        updatedTorrent.releaseData?.type === "TV" ||
        updatedTorrent.releaseData?.type === "Movie" ||
        updatedTorrent.releaseData?.type === "Anime"
      ) {
        log.debug({ infoHash }, "Queuing for enrichment");
        await enrichQueue.add("enrich", { infoHash }, { delay: 1000 });
      }
    },
    {
      connection,
      concurrency: 5,
      maxStalledCount: 1,
    },
  );
}
