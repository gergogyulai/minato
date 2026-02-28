import { Job } from 'bullmq';
import { db, torrents, enrichments } from '@project-minato/db';
import { eq } from 'drizzle-orm';
import { meiliClient, formatTorrentForMeilisearch } from '@project-minato/meilisearch';

const BATCH_SIZE = 1000;

export async function performForceReindex(_job: Job) {
  const index = meiliClient.index('torrents');

  console.log('[ForceReindex] Starting full Meilisearch reindex...');

  const deleteTask = await index.deleteAllDocuments();
  await meiliClient.tasks.waitForTask(deleteTask.taskUid, { timeout: 60_000 });
  console.log('[ForceReindex] Index cleared.');

  // 2. Stream all torrents from the DB in batches and re-index them.
  let offset = 0;
  let totalIndexed = 0;

  while (true) {
    const rows = await db
      .select()
      .from(torrents)
      .leftJoin(enrichments, eq(enrichments.torrentInfoHash, torrents.infoHash))
      .limit(BATCH_SIZE)
      .offset(offset);

    if (rows.length === 0) break;

    const documents = rows.map(({ torrents: torrent, enrichments: enrichment }) =>
      formatTorrentForMeilisearch({ ...torrent, enrichment: enrichment ?? null }),
    );

    const addTask = await index.addDocuments(documents, { primaryKey: 'infoHash' });
    await meiliClient.tasks.waitForTask(addTask.taskUid, { timeout: 120_000 });

    totalIndexed += documents.length;
    offset += rows.length;

    console.log(`[ForceReindex] Indexed ${totalIndexed} documents so far...`);

    // If we got fewer rows than the batch size this was the last page.
    if (rows.length < BATCH_SIZE) break;
  }

  console.log(`[ForceReindex] Done. Indexed ${totalIndexed} documents in total.`);
  return { totalIndexed };
}