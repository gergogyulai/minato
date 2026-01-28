import { 
  pgTable, 
  text, 
  bigint, 
  timestamp, 
  index, 
  jsonb, 
  integer, 
  varchar, 
  boolean, 
  primaryKey,
  uuid 
} from "drizzle-orm/pg-core";
import { type InferSelectModel, type InferInsertModel } from "drizzle-orm";

export const torrents = pgTable("torrents", {
  infoHash: text("info_hash").primaryKey(), 
  title: text("title").notNull(),
  size: bigint("size", { mode: "bigint" }).notNull(),
  seeders: integer("seeders").default(0),
  leechers: integer("leechers").default(0),
  category: text("category"),
  files: jsonb('files'),
  magnet: text("magnet"),
  sourceName: text("source_name").notNull(), 
  sourceUrl: text("source_url"),
  isDirty: boolean("is_dirty").default(true), 
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  indexedAt: timestamp("indexed_at"),
  enrichedAt: timestamp("enriched_at"),
}, (table) => ({
  titleIdx: index("title_idx").on(table.title),
  categoryIdx: index("category_idx").on(table.category),
  createdAtIdx: index("created_at_idx").on(table.createdAt),
  dirtyIdx: index("dirty_idx").on(table.isDirty), 
}));

export const classifications = pgTable("classifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  contentType: varchar("content_type", { length: 50 }).notNull(),
  confidenceScore: integer("confidence_score").default(0),
  metadata: jsonb("metadata").$type<{
    imdbId?: string;
    tmdbId?: number;
    season?: number;
    episode?: number;
    year?: number;
    isbn?: string;
    os?: string;
    language?: string;
  }>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  typeIdx: index("type_idx").on(table.contentType),
}));

// 3. Junction Table (M2M Bridge)
export const torrentToClassifications = pgTable("torrent_to_classifications", {
  infoHash: text("info_hash")
    .notNull()
    .references(() => torrents.infoHash, { onDelete: "cascade" }),
  classificationId: uuid("classification_id")
    .notNull()
    .references(() => classifications.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.infoHash, table.classificationId] }),
  infoHashIdx: index("junction_info_hash_idx").on(table.infoHash),
  classIdIdx: index("junction_class_id_idx").on(table.classificationId),
}));

export type Torrent = InferSelectModel<typeof torrents>;
export type NewTorrent = InferInsertModel<typeof torrents>;

export type Classification = InferSelectModel<typeof classifications>;
export type NewClassification = InferInsertModel<typeof classifications>;

export type TorrentToClassification = InferSelectModel<typeof torrentToClassifications>;