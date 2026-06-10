import { z } from "zod";

export const BlacklistTorrentsSchema = z.object({
	infoHashes: z
		.array(z.string().length(40))
		.min(1)
		.describe("Array of 40-character info hashes to blacklist"),
	reason: z.string().min(1).describe("Reason for blacklisting these torrents"),
	deleteFromDatabase: z
		.boolean()
		.default(true)
		.describe("Whether to delete torrents from database after blacklisting"),
});

export const BlacklistTorrentsResponseSchema = z.object({
	success: z.boolean(),
	message: z.string(),
});

export const RemoveBlacklistedTorrentsSchema = z.object({
	infoHashes: z
		.array(z.string().length(40))
		.min(1)
		.describe("Array of info hashes to remove from blacklist"),
});

export const RemoveBlacklistedTorrentsResponseSchema = z.object({
	success: z.boolean(),
	message: z.string(),
});

export const ListBlacklistedTorrentsResponseSchema = z.object({
	torrents: z.array(
		z.object({
			infoHash: z.string().length(40),
			reason: z.string(),
			createdAt: z.date(),
		}),
	),
});

export const AddBlacklistedTrackerSchema = z.object({
	urls: z
		.array(z.string())
		.min(1)
		.describe("Array of tracker URLs or patterns to blacklist"),
	reason: z.string().min(1).describe("Reason for blacklisting these trackers"),
});

export const AddBlacklistedTrackerResponseSchema = z.object({
	success: z.boolean(),
	message: z.string(),
});

export const RemoveBlacklistedTrackerSchema = z.object({
	ids: z
		.array(z.string().uuid())
		.min(1)
		.describe("Array of blacklist entry IDs to remove"),
});

export const RemoveBlacklistedTrackerResponseSchema = z.object({
	success: z.boolean(),
	message: z.string(),
});

export const ListBlacklistedTrackersResponseSchema = z.object({
	trackers: z.array(
		z.object({
			id: z.string().uuid(),
			urls: z.array(z.string()),
			reason: z.string(),
			createdAt: z.date(),
		}),
	),
});
