import { db, torrents, eq } from "@project-minato/db";

/**
 * Marks a torrent as enriched in the DB to prevent re-processing.
 */
export async function markTorrentProcessed(infoHash: string) {
  await db
    .update(torrents)
    .set({ enrichedAt: new Date(), isDirty: false })
    .where(eq(torrents.infoHash, infoHash));
}