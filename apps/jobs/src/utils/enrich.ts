import { db, eq, torrents } from "@project-minato/db";

/**
 * Marks a torrent as enriched in the DB to prevent re-processing.
 * Returns the updated torrent row to avoid a follow-up SELECT.
 */
export async function markAsEnriched(infoHash: string) {
	const [updated] = await db
		.update(torrents)
		.set({ enrichedAt: new Date(), isDirty: false })
		.where(eq(torrents.infoHash, infoHash))
		.returning();
	return updated;
}
