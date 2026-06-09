import {
  connection,
  ENRICH_JOBS,
  QUEUES,
  enrichQueue,
} from "@project-minato/queue";
import { db, torrents } from "@project-minato/db";
import { eq } from "drizzle-orm";
import {
  formatTorrentForMeilisearch,
  meiliClient,
} from "@project-minato/meilisearch";

import { type Job, Worker } from "bullmq";
import { logger } from "@project-minato/utils/logger";
import { generateMetadataFromRelease } from "@/lib/repair/generation";

const log = logger.child({ worker: "ai-repair-worker" });

interface AIRepairJobData {
  infoHash: string;
}

export function startRepairWorker() {
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

      const minimalReleaseData = Object.fromEntries(
        Object.entries(torrent.releaseData).filter(
          ([_, value]) => value !== null && value !== undefined && value !== "",
        ),
      );
      const minimalReleaseDataString = JSON.stringify(minimalReleaseData);

      const repairedReleaseData = await generateMetadataFromRelease(
        minimalReleaseDataString,
      );
      const repairedReleaseDataObj = JSON.parse(repairedReleaseData);

      const mergedReleaseData = {
        ...torrent.releaseData,
        ...repairedReleaseDataObj,
      };

      log.info({ infoHash, repairedReleaseData }, "Repaired release data");

      const [updatedTorrent] = await db
        .update(torrents)
        .set({
          releaseData: mergedReleaseData,
          type: repairedReleaseDataObj.type ?? null,
          isDirty: false,
          repairedAt: new Date(),
        })
        .where(eq(torrents.infoHash, infoHash))
        .returning();

      if (!updatedTorrent) {
        log.warn({ infoHash }, "Updated torrent not found");
        return;
      }

      await meiliClient
        .index("torrents")
        .addDocuments([formatTorrentForMeilisearch(updatedTorrent)], {
          primaryKey: "infoHash",
        });

      log.debug({ infoHash }, "Queuing for re-enrichment after repair");
      await enrichQueue.add(ENRICH_JOBS.REFRESH, { infoHash }, { delay: 1000 });
    },
    {
      connection,
      concurrency: 5,
      maxStalledCount: 1,
    },
  );
}
