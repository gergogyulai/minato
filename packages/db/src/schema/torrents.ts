import {
	type InferInsertModel,
	type InferSelectModel,
	relations,
	sql,
} from "drizzle-orm";
import {
	bigint,
	boolean,
	index,
	integer,
	jsonb,
	pgTable,
	text,
	timestamp,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import type { ReleaseData, releaseType } from "release-parser";

export type { ReleaseData, releaseType };

type FileInfo = {
	filename: string;
	size: number;
};

type Sources = {
	name: string;
	origin: string | null;
	originUrl: string | null;
	url: string | null;
	scraper: string;
};

export const torrents = pgTable(
	"torrents",
	{
		infoHash: text("info_hash").primaryKey().notNull(),
		trackerTitle: text("tracker_title").notNull(),
		size: bigint("size", { mode: "number" }).notNull(),
		seeders: integer("seeders").default(0),
		leechers: integer("leechers").default(0),
		trackerCategory: text("tracker_category"),
		standardCategory: integer("standard_category"),
		files: jsonb("files").$type<FileInfo[]>(),
		magnet: text("magnet"),
		sources: jsonb("sources").$type<Sources[]>().notNull().default([]),
		type: text("type"),
		isDirty: boolean("is_dirty").default(true),
		releaseData: jsonb("release_data").$type<ReleaseData>(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.notNull()
			.$onUpdate(() => new Date()),
		publishedAt: timestamp("published_at"),
		lastSeenAt: timestamp("last_seen_at").defaultNow().notNull(),
		indexedAt: timestamp("indexed_at"),
		enrichedAt: timestamp("enriched_at"),
	},
	(table) => [
		index("is_dirty_partial_idx")
			.on(table.isDirty)
			.where(sql`is_dirty IS TRUE`),
		index("sources_gin_idx").using("gin", table.sources),
		index("created_at_idx").on(table.createdAt),
		index("type_idx").on(table.type),
	],
);

export const enrichments = pgTable(
	"enrichments",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		torrentInfoHash: text("torrent_info_hash")
			.notNull()
			.unique()
			.references(() => torrents.infoHash, {
				onDelete: "cascade",
			}),
		mediaType: text("media_type").$type<
			"movie" | "tv" | "anime" | "music" | "book"
		>(),
		title: text("title"),
		genres: text("genres").array(),
		posterUrl: text("poster_url"),
		backdropUrl: text("backdrop_url"),
		overview: text("overview"),
		tagline: text("tagline"),
		year: integer("year"),
		releaseDate: timestamp("release_date"),
		status: text("status"),
		runtime: integer("runtime"),
		tmdbId: integer("tmdb_id"),
		imdbId: varchar("imdb_id", { length: 20 }),
		tvdbId: integer("tvdb_id"),
		anilistId: integer("anilist_id"),
		malId: integer("mal_id"),
		mbId: varchar("mb_id", { length: 40 }),
		discogsId: integer("discogs_id"),
		spotifyId: varchar("spotify_id", { length: 30 }),
		musicDetails: jsonb("music_details").$type<{
			artist?: string | null;
			albumArtist?: string | null;
			trackCount?: number | null;
			tracklist?: Array<{
				position?: string | null;
				title: string;
				duration?: string | null;
			}> | null;
		}>(),
		provider: text("provider"),
		contentRating: varchar("content_rating", { length: 10 }),
		seriesDetails: jsonb("series_details").$type<{
			seasonNumber?: number | string | null;
			episodeNumber?: number | string | null;
			episodeTitle?: string | null;
			isSeasonPack?: boolean | null;
			totalSeasons?: number | null;
			totalEpisodes?: number | null;
		}>(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
	},
	(table) => [
		index("tmdb_id_idx").on(table.tmdbId),
		index("imdb_id_idx").on(table.imdbId),
		index("tvdb_id_idx").on(table.tvdbId),
		index("anilist_id_idx").on(table.anilistId),
		index("mal_id_idx").on(table.malId),
		index("mb_id_idx").on(table.mbId),
		index("discogs_id_idx").on(table.discogsId),
		index("spotify_id_idx").on(table.spotifyId),
		index("info_hash_idx").on(table.torrentInfoHash),
	],
);

export const blacklistedTorrents = pgTable("blacklisted_torrents", {
	infoHash: text("info_hash").primaryKey(),
	reason: text("reason").notNull(),
	createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const blacklistedTrackers = pgTable("blacklisted_trackers", {
	id: uuid("id").defaultRandom().primaryKey(),
	url: text("url").notNull().array(),
	reason: text("reason").notNull(),
	createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const torrentsRelations = relations(torrents, ({ one }) => ({
	enrichment: one(enrichments, {
		fields: [torrents.infoHash],
		references: [enrichments.torrentInfoHash],
	}),
}));

export const enrichmentsRelations = relations(enrichments, ({ one }) => ({
	torrent: one(torrents, {
		fields: [enrichments.torrentInfoHash],
		references: [torrents.infoHash],
	}),
}));

export type Torrent = InferSelectModel<typeof torrents>;
export type NewTorrent = InferInsertModel<typeof torrents>;

export const NewTorrentSchema = createInsertSchema(torrents);
export const TorrentSchema = createSelectSchema(torrents);

export type Enrichment = InferSelectModel<typeof enrichments>;
export type NewEnrichment = InferInsertModel<typeof enrichments>;

export const EnrichmentSchema = createSelectSchema(enrichments);
export const NewEnrichmentSchema = createInsertSchema(enrichments);

export type BlacklistedTorrent = InferSelectModel<typeof blacklistedTorrents>;
export type NewBlacklistedTorrent = InferInsertModel<
	typeof blacklistedTorrents
>;

export const NewBlacklistedTorrentSchema =
	createInsertSchema(blacklistedTorrents);
export const BlacklistedTorrentSchema = createSelectSchema(blacklistedTorrents);
