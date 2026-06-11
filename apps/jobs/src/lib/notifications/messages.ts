import { Embed } from "diswhook";
import type { ExecuteWebhookData } from "diswhook";
import type { NotificationEvent } from "@project-minato/queue";

export type PlainMessage = { title: string; body: string };

export function formatMessage(
	event: NotificationEvent,
	payload: Record<string, unknown>,
): PlainMessage {
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
		case "wanted_torrent_found":
			return {
				title: "Wanted torrent found",
				body: `"${payload.title ?? payload.infoHash}" matched a wanted item${payload.scraperName ? ` via ${payload.scraperName}` : ""}.`,
			};
	}
}

// ---------------------------------------------------------------------------
// Discord embed builders
// ---------------------------------------------------------------------------

function stateEmoji(state: unknown): string {
	switch (String(state)) {
		case "running":   return "▶️";
		case "idle":      return "💤";
		case "scheduled": return "📅";
		case "error":     return "❌";
		case "stopped":   return "⏹️";
		default:          return "●";
	}
}

function toStateColor(toState: unknown): number {
	switch (String(toState)) {
		case "running":   return 0x3b82f6; // blue
		case "error":     return 0xef4444; // red
		case "scheduled": return 0x8b5cf6; // violet
		case "stopped":   return 0x6b7280; // slate
		default:          return 0x94a3b8; // muted
	}
}

export function buildDiscordMessage(
	event: NotificationEvent,
	payload: Record<string, unknown>,
): ExecuteWebhookData {
	switch (event) {
		case "wanted_torrent_found": {
			const embed = new Embed()
				.setColor(0x10b981)
				.setAuthor("🎯  Wanted match — Minato")
				.setTitle(String(payload.title ?? payload.infoHash ?? "Unknown release"))
				.setDescription("A release matching your watchlist has been grabbed and queued for download.")
				.setFooter("Minato")
				.setTimestamp();

			if (payload.scraperName) embed.addField("📡  Source",     String(payload.scraperName),                        true);
			if (payload.type)        embed.addField("🎞️  Type",       String(payload.type),                              true);
			if (payload.resolution)  embed.addField("🖥️  Resolution", String(payload.resolution),                        true);
			if (payload.size)        embed.addField("💾  Size",        String(payload.size),                              true);
			if (payload.seeders != null) embed.addField("🌱  Seeders", Number(payload.seeders).toLocaleString(),          true);
			if (payload.group)       embed.addField("👥  Group",       `\`${String(payload.group)}\``,                    true);
			if (payload.posterUrl)   embed.setThumbnail(String(payload.posterUrl));

			return { embeds: [embed.toJSON()] };
		}

		case "scraper_completed": {
			return {
				embeds: [
					new Embed()
						.setColor(0x22c55e)
						.setAuthor("✅  Scraper — Minato")
						.setTitle(String(payload.scraperName ?? payload.scraperId ?? "Scraper"))
						.setDescription("Run finished without errors.")
						.setFooter("Minato")
						.setTimestamp()
						.toJSON(),
				],
			};
		}

		case "scraper_failed": {
			const restarts = Number(payload.restarts ?? 0);
			const embed = new Embed()
				.setColor(0xef4444)
				.setAuthor("🚨  Scraper error — Minato")
				.setTitle(String(payload.scraperName ?? payload.scraperId ?? "Scraper"))
				.setDescription(
					restarts > 0
						? `Run failed and will be retried. This scraper has restarted **${restarts}** time${restarts === 1 ? "" : "s"}.`
						: "Run failed.",
				)
				.addField("🔢  Exit code", `\`${payload.exitCode ?? "unknown"}\``, true)
				.addField("🔁  Restart #", String(restarts), true)
				.setFooter("Minato")
				.setTimestamp();
			return { embeds: [embed.toJSON()] };
		}

		case "scraper_state_changed": {
			const from = String(payload.fromState ?? "?");
			const to   = String(payload.toState   ?? "?");
			return {
				embeds: [
					new Embed()
						.setColor(toStateColor(payload.toState))
						.setAuthor("🔄  Scraper status — Minato")
						.setTitle(String(payload.scraperName ?? payload.scraperId ?? "Scraper"))
						.setDescription(`${stateEmoji(from)}  **${from}**  →  ${stateEmoji(to)}  **${to}**`)
						.setFooter("Minato")
						.setTimestamp()
						.toJSON(),
				],
			};
		}

	}
}
