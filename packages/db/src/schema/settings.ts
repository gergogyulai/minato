import { integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

type JsonbValue =
	| string
	| number
	| boolean
	| null
	| JsonbValue[]
	| { [k: string]: JsonbValue };

export const settings = pgTable("settings", {
	key: text("key").primaryKey(),
	value: jsonb("value").$type<JsonbValue>().notNull(),
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at")
		.defaultNow()
		.$onUpdate(() => new Date())
		.notNull(),
});

export type Settings = typeof settings.$inferSelect;
export type NewSettings = typeof settings.$inferInsert;

export const settingsMeta = pgTable("settings_meta", {
	id: integer("id").primaryKey().default(1),
	version: integer("version").notNull(),
});

export type SettingsMeta = typeof settingsMeta.$inferSelect;
