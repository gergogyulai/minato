import type { NotificationChannel } from "@project-minato/db";
import type { NotificationEvent } from "@project-minato/queue";

import { buildDiscordMessage, formatMessage } from "./messages";
import { sendDiscord } from "./channels/discord";
import { sendNtfy } from "./channels/ntfy";
import { sendTelegram } from "./channels/telegram";

export async function deliverToChannel(
	channel: NotificationChannel,
	event: NotificationEvent,
	payload: Record<string, unknown>,
): Promise<void> {
	switch (channel.type) {
		case "discord":
			await sendDiscord(
				channel.config as { webhookUrl: string },
				buildDiscordMessage(event, payload),
			);
			break;
		case "telegram": {
			const { title, body } = formatMessage(event, payload);
			await sendTelegram(
				channel.config as { botToken: string; chatId: string },
				title,
				body,
			);
			break;
		}
		case "ntfy": {
			const { title, body } = formatMessage(event, payload);
			await sendNtfy(
				channel.config as { url: string; topic: string; token?: string },
				title,
				body,
			);
			break;
		}
	}
}
