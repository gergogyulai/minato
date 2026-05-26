import {
  pgTable,
  text,
  timestamp,
  integer,
  jsonb,
  uuid,
  index,
} from "drizzle-orm/pg-core";
import { relations, type InferSelectModel, type InferInsertModel } from "drizzle-orm";

export const scrapers = pgTable("scrapers", {
  id: text("id").primaryKey(),
  type: text("type").$type<"first_party" | "community">().notNull(),
  apiKey: text("api_key").notNull().unique(),
  capabilities: jsonb("capabilities").$type<string[]>().notNull().default([]),
  config: jsonb("config")
    .$type<Record<string, unknown>>()
    .notNull()
    .default({}),
  status: text("status")
    .$type<"registered" | "running" | "paused" | "error" | "stopped">()
    .notNull()
    .default("registered"),
  pid: integer("pid"),
  installedAt: timestamp("installed_at").defaultNow().notNull(),
  lastSeenAt: timestamp("last_seen_at"),
});

export const scraperStatus = pgTable("scraper_status", {
  scraperId: text("scraper_id")
    .primaryKey()
    .notNull()
    .references(() => scrapers.id, { onDelete: "cascade" }),
  phase: text("phase").$type<"idle" | "running" | "paused" | "error">(),
  progress: jsonb("progress").$type<{ current: number; total?: number }>(),
  message: text("message"),
  reportedAt: timestamp("reported_at").defaultNow().notNull(),
});

export const scraperCommands = pgTable(
  "scraper_commands",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    scraperId: text("scraper_id")
      .notNull()
      .references(() => scrapers.id, { onDelete: "cascade" }),
    command: text("command")
      .$type<"pause" | "stop" | "resume">()
      .notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>(),
    status: text("status")
      .$type<"pending" | "acked" | "done" | "failed">()
      .notNull()
      .default("pending"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    ackedAt: timestamp("acked_at"),
  },
  (table) => [
    index("scraper_commands_scraper_id_idx").on(table.scraperId),
    index("scraper_commands_status_idx").on(table.status),
  ],
);

export const scrapersRelations = relations(scrapers, ({ one, many }) => ({
  statusReport: one(scraperStatus, {
    fields: [scrapers.id],
    references: [scraperStatus.scraperId],
  }),
  commands: many(scraperCommands),
}));

export const scraperStatusRelations = relations(scraperStatus, ({ one }) => ({
  scraper: one(scrapers, {
    fields: [scraperStatus.scraperId],
    references: [scrapers.id],
  }),
}));

export const scraperCommandsRelations = relations(
  scraperCommands,
  ({ one }) => ({
    scraper: one(scrapers, {
      fields: [scraperCommands.scraperId],
      references: [scrapers.id],
    }),
  }),
);

export type Scraper = InferSelectModel<typeof scrapers>;
export type NewScraper = InferInsertModel<typeof scrapers>;
export type ScraperStatusRow = InferSelectModel<typeof scraperStatus>;
export type ScraperCommand = InferSelectModel<typeof scraperCommands>;
