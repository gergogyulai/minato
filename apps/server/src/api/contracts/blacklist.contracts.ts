import { publicProcedure } from "../index";
import {
  BlacklistTorrentsSchema,
  BlacklistTorrentsResponseSchema,
  RemoveBlacklistedTorrentsSchema,
  RemoveBlacklistedTorrentsResponseSchema,
  ListBlacklistedTorrentsResponseSchema,
} from "@/schemas/blacklist-torrents.schema";
import {
  AddBlacklistedTrackerSchema,
  AddBlacklistedTrackerResponseSchema,
  RemoveBlacklistedTrackerSchema,
  RemoveBlacklistedTrackerResponseSchema,
  ListBlacklistedTrackersResponseSchema,
} from "@/schemas/blacklist-trackers.schema";

export const blacklistTorrentContracts = {
  add: publicProcedure
    .route({
      method: "POST",
      path: "/blacklist/torrents/add",
      summary: "Blacklist torrents",
      description:
        "Add torrents to the blacklist to prevent future ingestion. Optionally deletes them from the database.",
      tags: ["blacklist"],
    })
    .input(BlacklistTorrentsSchema)
    .output(BlacklistTorrentsResponseSchema),

  remove: publicProcedure
    .route({
      method: "POST",
      path: "/blacklist/torrents/remove",
      summary: "Remove torrents from blacklist",
      description: "Unblock previously blacklisted torrents.",
      tags: ["blacklist"],
    })
    .input(RemoveBlacklistedTorrentsSchema)
    .output(RemoveBlacklistedTorrentsResponseSchema),

  list: publicProcedure
    .route({
      method: "GET",
      path: "/blacklist/torrents",
      summary: "List blacklisted torrents",
      description: "Get all blocked torrent info hashes.",
      tags: ["blacklist"],
    })
    .output(ListBlacklistedTorrentsResponseSchema),
};

export const blacklistTrackerContracts = {
  add: publicProcedure
    .route({
      method: "POST",
      path: "/blacklist/trackers/add",
      summary: "Blacklist trackers",
      description: "Block specific tracker URLs or patterns.",
      tags: ["blacklist"],
    })
    .input(AddBlacklistedTrackerSchema)
    .output(AddBlacklistedTrackerResponseSchema),

  remove: publicProcedure
    .route({
      method: "POST",
      path: "/blacklist/trackers/remove",
      summary: "Remove trackers from blacklist",
      description: "Unblock previously blacklisted trackers.",
      tags: ["blacklist"],
    })
    .input(RemoveBlacklistedTrackerSchema)
    .output(RemoveBlacklistedTrackerResponseSchema),

  list: publicProcedure
    .route({
      method: "GET",
      path: "/blacklist/trackers",
      summary: "List blacklisted trackers",
      description: "Get all blocked tracker patterns.",
      tags: ["blacklist"],
    })
    .output(ListBlacklistedTrackersResponseSchema),
};

export const blacklistContracts = {
  torrent: blacklistTorrentContracts,
  tracker: blacklistTrackerContracts,
};
