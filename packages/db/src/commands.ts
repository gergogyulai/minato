// Both ends of the scraper command channel. The server writes command rows
// and NOTIFYs; the supervisor and the SSE endpoint LISTEN and claim rows.
// Sweeps on the consumer side cover missed notifications, so NOTIFY is a
// wake-up signal, never the source of truth — the table is.

import { sql } from "drizzle-orm";
import { Client } from "pg";
import { env } from "@project-minato/env/shared";
import { db } from "./index";
import {
	type ScraperCommandKind,
	scraperCommands,
} from "./schema/scrapers";

export const SCRAPER_COMMANDS_CHANNEL = "scraper_commands";
export const COMMAND_TTL_MS = 5 * 60_000;

const LISTEN_RECONNECT_BASE_MS = 1_000;
const LISTEN_RECONNECT_MAX_MS = 30_000;

export async function issueScraperCommand(opts: {
	scraperId: string;
	command: ScraperCommandKind;
	issuedBy?: string | null;
	payload?: Record<string, unknown>;
}): Promise<string> {
	return db.transaction(async (tx) => {
		const [row] = await tx
			.insert(scraperCommands)
			.values({
				scraperId: opts.scraperId,
				command: opts.command,
				payload: opts.payload,
				issuedBy: opts.issuedBy ?? null,
				expiresAt: new Date(Date.now() + COMMAND_TTL_MS),
			})
			.returning({ id: scraperCommands.id });
		if (!row) throw new Error("command insert returned no row");
		await tx.execute(
			sql`SELECT pg_notify(${SCRAPER_COMMANDS_CHANNEL}, ${opts.scraperId})`,
		);
		return row.id;
	});
}

// Dedicated connection (never the pool — LISTEN pins a session) that survives
// connection loss: reconnects with backoff and re-issues LISTEN.
export function listenScraperCommands(
	onWake: (scraperId: string) => void,
): { close(): Promise<void> } {
	let client: Client | null = null;
	let closed = false;
	let attempt = 0;
	let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

	async function connect(): Promise<void> {
		if (closed) return;
		const next = new Client({ connectionString: env.DATABASE_URL });
		next.on("notification", (msg) => {
			if (msg.channel === SCRAPER_COMMANDS_CHANNEL && msg.payload) {
				onWake(msg.payload);
			}
		});
		next.on("error", () => {
			/* surfaces via "end"; reconnect handles it */
		});
		next.on("end", () => {
			if (closed || client !== next) return;
			client = null;
			scheduleReconnect();
		});
		try {
			await next.connect();
			await next.query(`LISTEN ${SCRAPER_COMMANDS_CHANNEL}`);
			client = next;
			attempt = 0;
		} catch {
			await next.end().catch(() => {});
			scheduleReconnect();
		}
	}

	function scheduleReconnect(): void {
		if (closed || reconnectTimer) return;
		const delay = Math.min(
			LISTEN_RECONNECT_BASE_MS * 2 ** attempt,
			LISTEN_RECONNECT_MAX_MS,
		);
		attempt += 1;
		reconnectTimer = setTimeout(() => {
			reconnectTimer = null;
			void connect();
		}, delay);
	}

	void connect();

	return {
		async close(): Promise<void> {
			closed = true;
			if (reconnectTimer) clearTimeout(reconnectTimer);
			await client?.end().catch(() => {});
			client = null;
		},
	};
}
