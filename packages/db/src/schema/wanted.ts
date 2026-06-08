import { type InferInsertModel, type InferSelectModel, relations } from "drizzle-orm";
import {
	boolean,
	index,
	integer,
	pgTable,
	text,
	timestamp,
	unique,
	uuid,
} from "drizzle-orm/pg-core";

import { user } from "./auth";
import { torrents } from "./torrents";

export const wantedItems = pgTable(
	"wanted_items",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		enabled: boolean("enabled").notNull().default(true),
		oneShot: boolean("one_shot").notNull().default(false),

		// Content matchers, null means dont care
		mediaType: text("media_type").$type<"movie" | "tv" | "anime">(),
		tmdbId: integer("tmdb_id"),
		title: text("title"),
		year: integer("year"),

		// TV-specific matchers
		season: integer("season"),
		episode: integer("episode"),
		seasonPack: boolean("season_pack"),

		// Quality matchers
		resolution: text("resolution"),
		group: text("group"),
		requiredFlags: text("required_flags").array().default([]),
		excludedFlags: text("excluded_flags").array().default([]),

		lastMatchAt: timestamp("last_match_at"),
		createdAt: timestamp("created_at").notNull().defaultNow(),
		updatedAt: timestamp("updated_at")
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [index("wanted_items_user_id_idx").on(table.userId)],
);

export const wantedMatches = pgTable(
	"wanted_matches",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		wantedItemId: uuid("wanted_item_id")
			.notNull()
			.references(() => wantedItems.id, { onDelete: "cascade" }),
		torrentInfoHash: text("torrent_info_hash")
			.notNull()
			.references(() => torrents.infoHash, { onDelete: "cascade" }),
		matchedAt: timestamp("matched_at").notNull().defaultNow(),
	},
	(table) => [
		unique("wanted_matches_unique").on(table.wantedItemId, table.torrentInfoHash),
		index("wanted_matches_item_id_idx").on(table.wantedItemId),
		index("wanted_matches_torrent_idx").on(table.torrentInfoHash),
	],
);

export const wantedItemsRelations = relations(wantedItems, ({ one, many }) => ({
	user: one(user, { fields: [wantedItems.userId], references: [user.id] }),
	matches: many(wantedMatches),
}));

export const wantedMatchesRelations = relations(wantedMatches, ({ one }) => ({
	wantedItem: one(wantedItems, {
		fields: [wantedMatches.wantedItemId],
		references: [wantedItems.id],
	}),
	torrent: one(torrents, {
		fields: [wantedMatches.torrentInfoHash],
		references: [torrents.infoHash],
	}),
}));

export type WantedItem = InferSelectModel<typeof wantedItems>;
export type NewWantedItem = InferInsertModel<typeof wantedItems>;
export type WantedMatch = InferSelectModel<typeof wantedMatches>;
export type NewWantedMatch = InferInsertModel<typeof wantedMatches>;
