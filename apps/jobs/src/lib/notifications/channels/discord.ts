import { Webhook, type MessageBuilder } from "discord-webhook-node";

export async function sendDiscord(
	config: { webhookUrl: string },
	message: MessageBuilder,
): Promise<void> {
	const webhook = new Webhook({ url: config.webhookUrl, throwErrors: true });
	await webhook.send(message);
}
