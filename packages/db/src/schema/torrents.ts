import {
  pgTable,
  text,
  timestamp,
  index,
  jsonb,
  integer,
  varchar,
  boolean,
  numeric,
  uuid,
} from "drizzle-orm/pg-core";
import {
  type InferSelectModel,
  type InferInsertModel,
  relations,
} from "drizzle-orm";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import type { ReleaseData, releaseType } from "release-parser";

export const torrents = pgTable(
  "torrents",
  {
    infoHash: text("info_hash").primaryKey(),
    trackerTitle: text("tracker_title").notNull(),
    size: numeric("size").notNull(),
    seeders: integer("seeders").default(0),
    leechers: integer("leechers").default(0),
    _trackerCategory: text("tracker_category"),
    stdCategory: integer("std_category"),
    files: jsonb("files"),
    magnet: text("magnet"),
    sources: jsonb("sources")
      .$type<{ name: string; url: string | null }[]>()
      .notNull()
      .default([]),
    isDirty: boolean("is_dirty").default(true),

    // release data
    type: text("type").$type<releaseType>(),
    group: text("group"),
    resolution: text("resolution"),
    releaseTitle: text("release_title"),
    releaseData: jsonb("release_data").$type<ReleaseData>(),

    enrichmentId: uuid("enrichment_id").references(() => enrichments.id, {
      onDelete: "set null",
    }),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    indexedAt: timestamp("indexed_at"),
    enrichedAt: timestamp("enriched_at"),
  },
  (table) => [
    index("tracker_title_idx").on(table.trackerTitle),
    index("type_idx").on(table.type),
    index("created_at_idx").on(table.createdAt),
    index("sources_gin_idx").using("gin", table.sources),
    index("dirty_idx").on(table.isDirty),
  ],
);

export const enrichments = pgTable("enrichments", {
  id: uuid("id").defaultRandom().primaryKey(),
  mediaType: text("media_type").$type<
    "movie" | "tv" | "anime" | "music" | "book"
  >(),
  genres: text("genres").array(),
  posterUrl: text("poster_url"),
  backdropUrl: text("backdrop_url"),
  logoUrl: text("logo_url"),
  description: text("description"),
  tagline: text("tagline"),
  year: integer("year"),
  releaseDate: timestamp("release_date"),
  status: text("status"),
  runtime: integer("runtime"),
	tmdbId: integer("tmdb_id").unique(),
  imdbId: varchar("imdb_id", { length: 20 }),
  tvdbId: integer("tvdb_id"),
  anilistId: integer("anilist_id"),
  malId: integer("mal_id"),
  contentRating: varchar("content_rating", { length: 10 }),
  totalSeasons: integer("total_seasons"),
  totalEpisodes: integer("total_episodes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const torrentsRelations = relations(torrents, ({ one }) => ({
  enrichment: one(enrichments, {
    fields: [torrents.enrichmentId],
    references: [enrichments.id],
  }),
}));

export const enrichmentsRelations = relations(enrichments, ({ many }) => ({
  torrents: many(torrents),
}));

export type Torrent = InferSelectModel<typeof torrents>;
export type NewTorrent = InferInsertModel<typeof torrents>;

export const NewTorrentSchema = createInsertSchema(torrents);
export const TorrentSchema = createSelectSchema(torrents);

export type Enrichment = InferSelectModel<typeof enrichments>;
export type NewEnrichment = InferInsertModel<typeof enrichments>;

export const NewEnrichmentSchema = createInsertSchema(enrichments);
export const EnrichmentSchema = createSelectSchema(enrichments);
