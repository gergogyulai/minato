import { type InferInsertModel, type InferSelectModel } from "drizzle-orm";
import {
	boolean,
	index,
	jsonb,
	pgTable,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";

import { user } from "./auth";

export type NotificationChannelType = "telegram" | "ntfy" | "discord";

export type NotificationEvent =
	| "scraper_completed"
	| "scraper_failed"
	| "scraper_state_changed"
	| "torrent_digest"
	| "wanted_torrent_found";

export type TelegramChannelConfig = { botToken: string; chatId: string };
export type NtfyChannelConfig = { url: string; topic: string; token?: string };
export type DiscordChannelConfig = { webhookUrl: string };

export type NotificationChannelConfig =
	| TelegramChannelConfig
	| NtfyChannelConfig
	| DiscordChannelConfig;

export const notificationChannels = pgTable(
	"notification_channels",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		type: text("type").$type<NotificationChannelType>().notNull(),
		config: jsonb("config").$type<NotificationChannelConfig>().notNull(),
		events: text("events")
			.array()
			.$type<NotificationEvent[]>()
			.notNull()
			.default([]),
		enabled: boolean("enabled").notNull().default(true),
		lastDigestAt: timestamp("last_digest_at"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
	},
	(table) => [index("notification_channels_user_id_idx").on(table.userId)],
);

export type NotificationChannel = InferSelectModel<typeof notificationChannels>;
export type NewNotificationChannel = InferInsertModel<
	typeof notificationChannels
>;
