import {
  db,
  blacklistedTorrents,
  blacklistedTrackers,
  torrents,
  inArray,
} from "@project-minato/db";
import { blacklistContracts } from "../contracts/blacklist.contracts";

const torrent = {
  // Block an infoHash and remove existing records.
  add: blacklistContracts.torrent.add.handler(async ({ input }) => {
    const { infoHashes, reason, deleteFromDatabase } = input;

    await db.transaction(async (tx) => {
      // Add to blacklist
      await tx
        .insert(blacklistedTorrents)
        .values(
          infoHashes.map((hash) => ({
            infoHash: hash,
            reason,
          }))
        )
        .onConflictDoNothing();

      // Delete from torrents if requested
      if (deleteFromDatabase) {
        await tx.delete(torrents).where(inArray(torrents.infoHash, infoHashes));
      }
    });

    return {
      success: true,
      message: `Successfully blacklisted ${infoHashes.length} torrents.`,
    };
  }),

  // Unblock an infoHash.
  remove: blacklistContracts.torrent.remove.handler(async ({ input }) => {
    const { infoHashes } = input;

    await db
      .delete(blacklistedTorrents)
      .where(inArray(blacklistedTorrents.infoHash, infoHashes));

    return {
      success: true,
      message: `Successfully removed ${infoHashes.length} torrents from blacklist.`,
    };
  }),

  // List all blocked hashes.
  list: blacklistContracts.torrent.list.handler(async () => {
    const results = await db.select().from(blacklistedTorrents);
    return {
      torrents: results,
    };
  }),
};

const tracker = {
  // Block a tracker URL/pattern.
  add: blacklistContracts.tracker.add.handler(async ({ input }) => {
    const { urls, reason } = input;

    await db.insert(blacklistedTrackers).values({
      url: urls,
      reason,
    });

    return {
      success: true,
      message: "Successfully added tracker(s) to blacklist.",
    };
  }),

  // Unblock a tracker.
  remove: blacklistContracts.tracker.remove.handler(async ({ input }) => {
    const { ids } = input;

    await db
      .delete(blacklistedTrackers)
      .where(inArray(blacklistedTrackers.id, ids));

    return {
      success: true,
      message: `Successfully removed ${ids.length} tracker(s) from blacklist.`,
    };
  }),

  // List all blocked trackers.
  list: blacklistContracts.tracker.list.handler(async () => {
    const results = await db.select().from(blacklistedTrackers);
    return {
      trackers: results.map((t) => ({
        id: t.id,
        urls: t.url ?? [],
        reason: t.reason,
        createdAt: t.createdAt,
      })),
    };
  }),
};

export const blacklistRouter = {
  torrent,
  tracker,
};
