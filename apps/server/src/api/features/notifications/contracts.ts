import { z } from "zod";
import { protectedProcedure } from "@/api";

const notificationEventSchema = z.enum([
	"scraper_completed",
	"scraper_failed",
	"scraper_state_changed",
	"wanted_torrent_found",
]);

const telegramConfigSchema = z.object({
	botToken: z.string().min(1),
	chatId: z.string().min(1),
});

const ntfyConfigSchema = z.object({
	url: z.string().url(),
	topic: z.string().min(1),
	token: z.string().optional(),
});

const discordConfigSchema = z.object({
	webhookUrl: z.string().url(),
});

const channelConfigSchema = z.union([
	telegramConfigSchema,
	ntfyConfigSchema,
	discordConfigSchema,
]);

const channelOutputSchema = z.object({
	id: z.string(),
	userId: z.string(),
	name: z.string(),
	type: z.enum(["telegram", "ntfy", "discord"]),
	config: channelConfigSchema,
	events: z.array(notificationEventSchema),
	enabled: z.boolean(),
	createdAt: z.date(),
	updatedAt: z.date(),
});

export const notificationsListContract = protectedProcedure
	.route({
		method: "GET",
		path: "/notifications/channels",
		summary: "List notification channels",
		tags: ["notifications"],
	})
	.output(z.object({ channels: z.array(channelOutputSchema) }));

export const notificationsCreateContract = protectedProcedure
	.route({
		method: "POST",
		path: "/notifications/channels",
		summary: "Create a notification channel",
		tags: ["notifications"],
	})
	.input(
		z.object({
			name: z.string().min(1).max(64),
			type: z.enum(["telegram", "ntfy", "discord"]),
			config: channelConfigSchema,
			events: z.array(notificationEventSchema).min(1),
		}),
	)
	.output(channelOutputSchema);

export const notificationsUpdateContract = protectedProcedure
	.route({
		method: "POST",
		path: "/notifications/channels/update",
		summary: "Update a notification channel",
		tags: ["notifications"],
	})
	.input(
		z.object({
			id: z.string().uuid(),
			name: z.string().min(1).max(64).optional(),
			config: channelConfigSchema.optional(),
			events: z.array(notificationEventSchema).min(1).optional(),
			enabled: z.boolean().optional(),
		}),
	)
	.output(channelOutputSchema);

export const notificationsDeleteContract = protectedProcedure
	.route({
		method: "POST",
		path: "/notifications/channels/delete",
		summary: "Delete a notification channel",
		tags: ["notifications"],
	})
	.input(z.object({ id: z.string().uuid() }))
	.output(z.object({ success: z.boolean() }));

export const notificationsTestContract = protectedProcedure
	.route({
		method: "POST",
		path: "/notifications/channels/test",
		summary: "Send a test notification to a channel",
		tags: ["notifications"],
	})
	.input(z.object({ id: z.string().uuid() }))
	.output(z.object({ success: z.boolean() }));
