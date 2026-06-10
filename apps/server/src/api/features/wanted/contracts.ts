import { z } from "zod";
import { protectedProcedure } from "@/api";

const KNOWN_FLAGS = [
	"Dolby Vision",
	"HDR10+",
	"HDR10",
	"HDR",
	"HLG",
	"DDP",
	"DTS-HD MA",
	"DTS-X",
	"TrueHD",
	"Atmos",
	"REMUX",
	"IMAX",
	"Proper",
	"Repack",
] as const;

export const WANTED_FLAGS = KNOWN_FLAGS;

const mediaTypeSchema = z.enum(["movie", "tv", "anime"]);
const resolutionSchema = z.enum(["2160p", "1080p", "720p", "480p"]);
const flagSchema = z.string();

const wantedItemOutputSchema = z.object({
	id: z.string().uuid(),
	userId: z.string(),
	name: z.string(),
	enabled: z.boolean(),
	oneShot: z.boolean(),
	mediaType: mediaTypeSchema.nullable(),
	tmdbId: z.number().nullable(),
	title: z.string().nullable(),
	year: z.number().nullable(),
	season: z.number().nullable(),
	episode: z.number().nullable(),
	seasonPack: z.boolean().nullable(),
	resolution: z.string().nullable(),
	group: z.string().nullable(),
	requiredFlags: z.array(flagSchema),
	excludedFlags: z.array(flagSchema),
	lastMatchAt: z.date().nullable(),
	createdAt: z.date(),
	updatedAt: z.date(),
	matchCount: z.number(),
});

const wantedMatchOutputSchema = z.object({
	id: z.string().uuid(),
	wantedItemId: z.string().uuid(),
	torrentInfoHash: z.string(),
	matchedAt: z.date(),
	torrentTitle: z.string().nullable(),
	resolution: z.string().nullable(),
	seeders: z.number().nullable(),
	size: z.number(),
});

export const wantedListContract = protectedProcedure
	.route({
		method: "GET",
		path: "/wanted",
		summary: "List watchlist entries",
		tags: ["wanted"],
	})
	.output(z.object({ items: z.array(wantedItemOutputSchema) }));

export const wantedCreateContract = protectedProcedure
	.route({
		method: "POST",
		path: "/wanted",
		summary: "Create a watchlist entry",
		tags: ["wanted"],
	})
	.input(
		z.object({
			name: z.string().min(1).max(128),
			oneShot: z.boolean().default(false),
			mediaType: mediaTypeSchema.nullable().default(null),
			tmdbId: z.number().int().positive().nullable().default(null),
			title: z.string().min(1).max(256).nullable().default(null),
			year: z.number().int().min(1888).max(2100).nullable().default(null),
			season: z.number().int().positive().nullable().default(null),
			episode: z.number().int().positive().nullable().default(null),
			seasonPack: z.boolean().nullable().default(null),
			resolution: resolutionSchema.nullable().default(null),
			group: z.string().min(1).max(64).nullable().default(null),
			requiredFlags: z.array(flagSchema).default([]),
			excludedFlags: z.array(flagSchema).default([]),
		}),
	)
	.output(wantedItemOutputSchema);

export const wantedUpdateContract = protectedProcedure
	.route({
		method: "POST",
		path: "/wanted/update",
		summary: "Update a watchlist entry",
		tags: ["wanted"],
	})
	.input(
		z.object({
			id: z.string().uuid(),
			name: z.string().min(1).max(128).optional(),
			enabled: z.boolean().optional(),
			oneShot: z.boolean().optional(),
			mediaType: mediaTypeSchema.nullable().optional(),
			tmdbId: z.number().int().positive().nullable().optional(),
			title: z.string().min(1).max(256).nullable().optional(),
			year: z.number().int().min(1888).max(2100).nullable().optional(),
			season: z.number().int().positive().nullable().optional(),
			episode: z.number().int().positive().nullable().optional(),
			seasonPack: z.boolean().nullable().optional(),
			resolution: resolutionSchema.nullable().optional(),
			group: z.string().min(1).max(64).nullable().optional(),
			requiredFlags: z.array(flagSchema).optional(),
			excludedFlags: z.array(flagSchema).optional(),
		}),
	)
	.output(wantedItemOutputSchema);

export const wantedDeleteContract = protectedProcedure
	.route({
		method: "POST",
		path: "/wanted/delete",
		summary: "Delete a watchlist entry",
		tags: ["wanted"],
	})
	.input(z.object({ id: z.string().uuid() }))
	.output(z.object({ success: z.boolean() }));

export const wantedTmdbSearchContract = protectedProcedure
	.route({
		method: "GET",
		path: "/wanted/tmdb-search",
		summary: "Search TMDB for watchlist content",
		tags: ["wanted"],
	})
	.input(
		z.object({
			q: z.string().min(2).max(200),
			type: z.enum(["movie", "tv"]).optional(),
		}),
	)
	.output(
		z.object({
			results: z.array(
				z.object({
					tmdbId: z.number(),
					title: z.string(),
					year: z.number().nullable(),
					posterUrl: z.string().nullable(),
					mediaType: z.enum(["movie", "tv"]),
				}),
			),
		}),
	);

export const wantedMatchesContract = protectedProcedure
	.route({
		method: "GET",
		path: "/wanted/{id}/matches",
		summary: "List matches for a watchlist entry",
		tags: ["wanted"],
	})
	.input(z.object({ id: z.string().uuid() }))
	.output(z.object({ matches: z.array(wantedMatchOutputSchema) }));
