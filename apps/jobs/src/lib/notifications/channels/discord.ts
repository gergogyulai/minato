import { Webhook } from "diswhook";
import type { ExecuteWebhookData } from "diswhook";

export async function sendDiscord(
	config: { webhookUrl: string },
	message: ExecuteWebhookData,
): Promise<void> {
	const webhook = new Webhook({ url: config.webhookUrl });
	await webhook.execute(message);
}
