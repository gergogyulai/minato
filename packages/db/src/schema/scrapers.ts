import {
	type InferInsertModel,
	type InferSelectModel,
	relations,
} from "drizzle-orm";
import {
	boolean,
	index,
	integer,
	jsonb,
	pgTable,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";

/**
 * Source of a scraper installation. Discriminated union stored as jsonb so
 * the registry / git / first-party shapes can evolve without schema changes.
 */
export type ScraperSource =
	| { kind: "first_party" }
	| { kind: "git"; url: string; ref?: string }
	| { kind: "registry"; slug: string; url: string };

export type ScraperManifestSnapshot = {
	id: string;
	name: string;
	title?: string;
	version: string;
	author?: string;
	entry: string;
	capabilities: string[];
	defaultConfig?: Record<string, unknown>;
};

export type ScraperState =
	| "installing"
	| "ready"
	| "starting"
	| "running"
	| "paused"
	| "scheduled"
	| "stopped"
	| "error"
	| "uninstalling";

export const scrapers = pgTable("scrapers", {
	// Identity — manifest.id
	id: text("id").primaryKey(),
	name: text("name").notNull(),

	// Auth — better-auth apikey.id; raw key is not stored here
	apiKeyId: text("api_key_id").notNull().unique(),

	// Installation source
	source: jsonb("source").$type<ScraperSource>().notNull(),
	installedVersion: text("installed_version").notNull(),
	manifest: jsonb("manifest").$type<ScraperManifestSnapshot>().notNull(),

	// Lifecycle authority — written by scraper.register; null between install
	// and first registration only.
	lifecycle: text("lifecycle").$type<"scheduled" | "daemon">(),

	// Scheduling — both are 5-field UTC cron expressions.
	// Effective = schedule ?? recommendedSchedule ?? null (manual only).
	recommendedSchedule: text("recommended_schedule"),
	schedule: text("schedule"),
	nextRunAt: timestamp("next_run_at"),

	// User config — defaults from manifest, overrides via admin
	config: jsonb("config")
		.$type<Record<string, unknown>>()
		.notNull()
		.default({}),

	// Runtime control
	enabled: boolean("enabled").notNull().default(true),
	state: text("state").$type<ScraperState>().notNull().default("installing"),
	pid: integer("pid"),
	lastError: text("last_error"),

	// Audit
	installedAt: timestamp("installed_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at").defaultNow().notNull(),
	lastSeenAt: timestamp("last_seen_at"),
});

export const scraperStatus = pgTable("scraper_status", {
	scraperId: text("scraper_id")
		.primaryKey()
		.notNull()
		.references(() => scrapers.id, { onDelete: "cascade" }),
	phase: text("phase").$type<"idle" | "running" | "paused" | "error">(),
	progressCurrent: integer("progress_current"),
	progressTotal: integer("progress_total"),
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
		command: text("command").$type<"pause" | "stop" | "resume">().notNull(),
		status: text("status")
			.$type<"pending" | "delivered" | "acked">()
			.notNull()
			.default("pending"),
		issuedBy: text("issued_by"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		deliveredAt: timestamp("delivered_at"),
		ackedAt: timestamp("acked_at"),
	},
	(table) => [
		index("scraper_commands_scraper_id_created_at_idx").on(
			table.scraperId,
			table.createdAt,
		),
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
