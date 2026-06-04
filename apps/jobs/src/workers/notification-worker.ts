import {
	and,
	db,
	eq,
	notificationChannels,
	sql,
	type NotificationChannel,
} from "@project-minato/db";
import {
	connection,
	NOTIFICATION_JOBS,
	QUEUES,
	notificationsQueue,
	type NotificationDispatchJobData,
	type NotificationEvent,
} from "@project-minato/queue";
import { type Job, Worker } from "bullmq";

import { logger } from "@/utils/logger";

const log = logger.child({ worker: "notifications" });

// ---------------------------------------------------------------------------
// Message formatting
// ---------------------------------------------------------------------------

function formatMessage(event: NotificationEvent, payload: Record<string, unknown>): {
	title: string;
	body: string;
} {
	switch (event) {
		case "scraper_completed":
			return {
				title: "Scraper completed",
				body: `${payload.scraperName ?? payload.scraperId} finished successfully.`,
			};
		case "scraper_failed":
			return {
				title: "Scraper failed",
				body: `${payload.scraperName ?? payload.scraperId} exited with code ${payload.exitCode ?? "unknown"} (restart #${payload.restarts ?? 0}).`,
			};
		case "scraper_state_changed":
			return {
				title: "Scraper state changed",
				body: `${payload.scraperName ?? payload.scraperId}: ${payload.fromState} → ${payload.toState}`,
			};
		case "torrent_digest":
			return {
				title: "Daily torrent digest",
				body: `${payload.count} new torrent${Number(payload.count) === 1 ? "" : "s"} ingested in the last 24 hours.`,
			};
		case "wanted_torrent_found":
			return {
				title: "Wanted torrent found",
				body: `"${payload.title ?? payload.infoHash}" matched a wanted item${payload.scraperName ? ` via ${payload.scraperName}` : ""}.`,
			};
	}
}

// ---------------------------------------------------------------------------
// HTTP senders
// ---------------------------------------------------------------------------

async function sendTelegram(
	config: { botToken: string; chatId: string },
	title: string,
	body: string,
): Promise<void> {
	const text = `<b>${title}</b>\n${body}`;
	const res = await fetch(
		`https://api.telegram.org/bot${config.botToken}/sendMessage`,
		{
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ chat_id: config.chatId, text, parse_mode: "HTML" }),
		},
	);
	if (!res.ok) {
		const detail = await res.text().catch(() => "");
		throw new Error(`Telegram API error ${res.status}: ${detail}`);
	}
}

async function sendNtfy(
	config: { url: string; topic: string; token?: string },
	title: string,
	body: string,
): Promise<void> {
	const url = `${config.url.replace(/\/$/, "")}/${config.topic}`;
	const headers: Record<string, string> = {
		Title: title,
		Priority: "3",
		"Content-Type": "text/plain",
	};
	if (config.token) headers.Authorization = `Bearer ${config.token}`;
	const res = await fetch(url, { method: "POST", headers, body });
	if (!res.ok) {
		const detail = await res.text().catch(() => "");
		throw new Error(`ntfy error ${res.status}: ${detail}`);
	}
}

type DiscordField = { name: string; value: string; inline?: boolean };
type DiscordEmbed = {
	color?: number;
	author?: { name: string; icon_url?: string };
	title?: string;
	url?: string;
	description?: string;
	fields?: DiscordField[];
	thumbnail?: { url: string };
	footer?: { text: string; icon_url?: string };
	timestamp?: string;
};

function buildDiscordEmbed(
	event: NotificationEvent,
	payload: Record<string, unknown>,
): DiscordEmbed {
	switch (event) {
		case "wanted_torrent_found": {
			const fields: DiscordField[] = [];
			if (payload.scraperName) fields.push({ name: "Source", value: String(payload.scraperName), inline: true });
			if (payload.type)        fields.push({ name: "Type",   value: String(payload.type),        inline: true });
			if (payload.resolution)  fields.push({ name: "Resolution", value: String(payload.resolution), inline: true });
			if (payload.size)        fields.push({ name: "Size",   value: String(payload.size),        inline: true });
			if (payload.seeders != null) fields.push({ name: "Seeders", value: Number(payload.seeders).toLocaleString(), inline: true });
			if (payload.group)       fields.push({ name: "Group",  value: String(payload.group),       inline: true });
			return {
				color: 0x10b981,
				author: { name: "🎯  Wanted match" },
				title: String(payload.title ?? payload.infoHash ?? "Unknown release"),
				description: "A release matching your watchlist was found and added to your library.",
				fields,
				...(payload.posterUrl ? { thumbnail: { url: String(payload.posterUrl) } } : {}),
				footer: { text: "Minato" },
				timestamp: new Date().toISOString(),
			};
		}
		case "scraper_completed": {
			const { title, body } = formatMessage(event, payload);
			return { color: 0x22c55e, title, description: body, timestamp: new Date().toISOString() };
		}
		case "scraper_failed": {
			const { title, body } = formatMessage(event, payload);
			return { color: 0xef4444, title, description: body, timestamp: new Date().toISOString() };
		}
		case "scraper_state_changed": {
			const { title, body } = formatMessage(event, payload);
			return { color: 0x3b82f6, title, description: body, timestamp: new Date().toISOString() };
		}
		case "torrent_digest": {
			const { title, body } = formatMessage(event, payload);
			return { color: 0x6366f1, title, description: body, timestamp: new Date().toISOString() };
		}
	}
}

async function sendDiscord(
	config: { webhookUrl: string },
	embed: DiscordEmbed,
): Promise<void> {
	const res = await fetch(config.webhookUrl, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ embeds: [embed] }),
	});
	if (!res.ok) {
		const detail = await res.text().catch(() => "");
		throw new Error(`Discord webhook error ${res.status}: ${detail}`);
	}
}

async function deliverToChannel(
	channel: NotificationChannel,
	event: NotificationEvent,
	payload: Record<string, unknown>,
): Promise<void> {
	const { title, body } = formatMessage(event, payload);
	switch (channel.type) {
		case "telegram":
			await sendTelegram(
				channel.config as { botToken: string; chatId: string },
				title,
				body,
			);
			break;
		case "ntfy":
			await sendNtfy(
				channel.config as { url: string; topic: string; token?: string },
				title,
				body,
			);
			break;
		case "discord":
			await sendDiscord(
				channel.config as { webhookUrl: string },
				buildDiscordEmbed(event, payload),
			);
			break;
	}
}

// ---------------------------------------------------------------------------
// Job handlers
// ---------------------------------------------------------------------------

async function handleDispatch(job: Job<NotificationDispatchJobData>): Promise<void> {
	const { event, payload, channelId } = job.data;

	const channels = channelId
		? await db
				.select()
				.from(notificationChannels)
				.where(
					and(
						eq(notificationChannels.id, channelId),
						eq(notificationChannels.enabled, true),
					),
				)
		: await db
				.select()
				.from(notificationChannels)
				.where(
					and(
						eq(notificationChannels.enabled, true),
						sql`${event} = ANY(${notificationChannels.events})`,
					),
				);

	if (channels.length === 0) return;

	const results = await Promise.allSettled(
		channels.map((ch) => deliverToChannel(ch, event, payload)),
	);

	const failures = results.filter((r) => r.status === "rejected");
	if (failures.length > 0) {
		for (const f of failures) {
			if (f.status === "rejected") {
				log.warn({ reason: f.reason }, "Channel delivery failed");
			}
		}
		if (failures.length === channels.length) {
			throw new Error(`All ${channels.length} channel(s) failed to deliver`);
		}
	}
}

async function handleDigest(): Promise<void> {
	const digestChannels = await db
		.select()
		.from(notificationChannels)
		.where(
			and(
				eq(notificationChannels.enabled, true),
				sql`'torrent_digest' = ANY(${notificationChannels.events})`,
			),
		);

	if (digestChannels.length === 0) return;

	const now = new Date();

	for (const channel of digestChannels) {
		const since = channel.lastDigestAt ?? new Date(now.getTime() - 24 * 60 * 60 * 1000);

		const result = await db.execute<{ count: string }>(
			sql`SELECT COUNT(*)::text AS count FROM torrents WHERE created_at > ${since}`,
		);
		const rows = (result as unknown as { rows?: { count: string }[] }).rows ?? result as unknown as { count: string }[];
		const count = Number(rows[0]?.count ?? 0);

		if (count > 0) {
			try {
				await deliverToChannel(channel, "torrent_digest", { count });
			} catch (err) {
				log.warn({ channelId: channel.id, err }, "Digest delivery failed");
			}
		}

		await db
			.update(notificationChannels)
			.set({ lastDigestAt: now, updatedAt: now })
			.where(eq(notificationChannels.id, channel.id));
	}
}

// ---------------------------------------------------------------------------
// Worker factory
// ---------------------------------------------------------------------------

export function startNotificationWorker() {
	// Register daily digest repeatable job; BullMQ deduplicates by jobId.
	void notificationsQueue.add(
		NOTIFICATION_JOBS.DIGEST,
		{} as NotificationDispatchJobData,
		{
			repeat: { every: 24 * 60 * 60 * 1000 },
			jobId: "daily-digest",
		},
	);

	return new Worker(
		QUEUES.NOTIFICATIONS,
		async (job: Job) => {
			switch (job.name) {
				case NOTIFICATION_JOBS.DISPATCH:
					return await handleDispatch(job as Job<NotificationDispatchJobData>);
				case NOTIFICATION_JOBS.DIGEST:
					return await handleDigest();
				default:
					log.warn({ jobName: job.name }, "Unknown notification job");
					throw new Error(`Unknown job name: ${job.name}`);
			}
		},
		{ connection, concurrency: 10 },
	);
}
