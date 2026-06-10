// Raw-Hono scraper endpoints that don't fit the oRPC contract layer: the
// supervisor's internal key provisioning, and the SSE command stream + ack
// for sidecar scrapers. Sidecars run outside the supervisor — this stream is
// how dashboard-issued commands reach them.

import { auth } from "@project-minato/auth";
import { getConfig } from "@project-minato/config";
import {
	and,
	apikey,
	asc,
	db,
	eq,
	gt,
	inArray,
	listenScraperCommands,
	type ScraperCommand,
	scraperCommands,
	scrapers,
	user,
} from "@project-minato/db";
import type { Context } from "hono";
import { streamSSE } from "hono/streaming";

const SSE_PING_INTERVAL_MS = 25_000;

// ---------------------------------------------------------------------------
// Ensure-key — supervisor-secret gated key provisioning
// ---------------------------------------------------------------------------

type EnsureKeyBody = {
	scraperId: string;
	manifest: {
		id: string;
		name: string;
		title: string;
		version: string;
		author?: string;
		entry: string;
		capabilities: string[];
		defaultConfig?: Record<string, unknown>;
		scraperType?: "scheduled" | "daemon" | "poller";
	};
	source:
		| { kind: "first_party" }
		| { kind: "git"; url: string; ref?: string }
		| { kind: "registry"; slug: string; url: string };
};

export async function handleEnsureKey(c: Context): Promise<Response> {
	const secret = c.req.header("X-Supervisor-Secret");
	const expected = getConfig().internalSupervisorSecret;
	if (!expected || !secret || secret !== expected) {
		return c.text("Unauthorized", 401);
	}

	let body: EnsureKeyBody;
	try {
		body = (await c.req.json()) as EnsureKeyBody;
	} catch {
		return c.text("Invalid JSON", 400);
	}

	if (!body.scraperId || !body.manifest?.id || !body.source?.kind) {
		return c.text("Missing required fields", 400);
	}

	const [admin] = await db
		.select({ id: user.id })
		.from(user)
		.where(eq(user.role, "admin"))
		.limit(1);
	if (!admin) {
		return c.text("No admin user found — complete setup first", 503);
	}

	const [existing] = await db
		.select({ apiKeyId: scrapers.apiKeyId })
		.from(scrapers)
		.where(eq(scrapers.id, body.scraperId))
		.limit(1);

	// Delete the old key directly from the auth table — bypasses the HTTP
	// auth layer which requires a user session and would fail silently here.
	if (existing) {
		await db.delete(apikey).where(eq(apikey.id, existing.apiKeyId));
	}

	const created = await auth.api.createApiKey({
		body: {
			name: `scraper:${body.scraperId}`,
			userId: admin.id,
			metadata: { type: "scraper", scraperId: body.scraperId },
		},
	});

	if (existing) {
		await db
			.update(scrapers)
			.set({
				name: body.manifest.title,
				apiKeyId: created.id,
				manifest: body.manifest,
				installedVersion: body.manifest.version,
				source: body.source,
				updatedAt: new Date(),
			})
			.where(eq(scrapers.id, body.scraperId));
	} else {
		await db.insert(scrapers).values({
			id: body.scraperId,
			name: body.manifest.title,
			apiKeyId: created.id,
			source: body.source,
			installedVersion: body.manifest.version,
			manifest: body.manifest,
			state: "ready",
			enabled: true,
		});
	}

	return c.json({ apiKey: created.key });
}

// ---------------------------------------------------------------------------
// Sidecar command stream — SSE delivery of command rows
// ---------------------------------------------------------------------------

async function authenticateSidecar(
	c: Context,
): Promise<{ scraperId: string } | Response> {
	const rawKey = c.req.header("X-Minato-Key") ?? c.req.query("apikey") ?? null;
	if (!rawKey) return c.text("Unauthorized", 401);

	const result = await auth.api.verifyApiKey({ body: { key: rawKey } });
	if (!result.valid || !result.key) return c.text("Unauthorized", 401);

	const meta = result.key.metadata as {
		type?: string;
		scraperId?: string;
	} | null;
	if (meta?.type !== "sidecar" || !meta.scraperId) {
		return c.text("Sidecar API key required", 403);
	}
	return { scraperId: meta.scraperId };
}

// One LISTEN connection fans out to all connected sidecar streams. Started
// lazily on the first connection; lives for the rest of the process.
const subscribers = new Map<string, Set<(row: ScraperCommand) => void>>();
let listener: { close(): Promise<void> } | null = null;

function subscribe(
	scraperId: string,
	onCommand: (row: ScraperCommand) => void,
): () => void {
	listener ??= listenScraperCommands((id) => {
		if (subscribers.has(id)) void deliverPending(id);
	});
	let set = subscribers.get(scraperId);
	if (!set) {
		set = new Set();
		subscribers.set(scraperId, set);
	}
	set.add(onCommand);
	return () => {
		set.delete(onCommand);
		if (set.size === 0) subscribers.delete(scraperId);
	};
}

// pending → delivered, atomically — mirrors the supervisor's claim so a
// command is only ever executed by one side.
async function claimCommand(id: string): Promise<ScraperCommand | null> {
	const [row] = await db
		.update(scraperCommands)
		.set({ status: "delivered", deliveredAt: new Date() })
		.where(
			and(
				eq(scraperCommands.id, id),
				eq(scraperCommands.status, "pending"),
				gt(scraperCommands.expiresAt, new Date()),
			),
		)
		.returning();
	return row ?? null;
}

async function deliverPending(scraperId: string): Promise<void> {
	const subs = subscribers.get(scraperId);
	if (!subs || subs.size === 0) return;

	const pending = await db
		.select()
		.from(scraperCommands)
		.where(
			and(
				eq(scraperCommands.scraperId, scraperId),
				eq(scraperCommands.status, "pending"),
				gt(scraperCommands.expiresAt, new Date()),
			),
		)
		.orderBy(asc(scraperCommands.createdAt));

	for (const row of pending) {
		const claimed = await claimCommand(row.id);
		if (!claimed) continue;
		for (const send of subs) send(claimed);
	}
}

async function touchLastSeen(scraperId: string): Promise<void> {
	await db
		.update(scrapers)
		.set({ lastSeenAt: new Date() })
		.where(eq(scrapers.id, scraperId));
}

export async function handleCommandStream(c: Context): Promise<Response> {
	const authed = await authenticateSidecar(c);
	if (authed instanceof Response) return authed;
	const { scraperId } = authed;

	// Replay: live rows the sidecar hasn't acked yet — everything after
	// Last-Event-ID on reconnect, everything outstanding on a fresh connect.
	const lastEventId = c.req.header("Last-Event-ID");
	let after: Date | null = null;
	if (lastEventId) {
		const [ref] = await db
			.select({ createdAt: scraperCommands.createdAt })
			.from(scraperCommands)
			.where(eq(scraperCommands.id, lastEventId))
			.limit(1);
		after = ref?.createdAt ?? null;
	}

	const replay = await db
		.select()
		.from(scraperCommands)
		.where(
			and(
				eq(scraperCommands.scraperId, scraperId),
				inArray(scraperCommands.status, ["pending", "delivered"]),
				gt(scraperCommands.expiresAt, new Date()),
				...(after ? [gt(scraperCommands.createdAt, after)] : []),
			),
		)
		.orderBy(asc(scraperCommands.createdAt));

	await touchLastSeen(scraperId);

	return streamSSE(c, async (stream) => {
		let resolveDone = () => {};
		const done = new Promise<void>((resolve) => {
			resolveDone = resolve;
		});

		const send = (row: ScraperCommand) => {
			void stream.writeSSE({
				id: row.id,
				event: "command",
				data: JSON.stringify({
					id: row.id,
					command: row.command,
					payload: row.payload,
					issuedAt: row.createdAt.toISOString(),
				}),
			});
		};

		const unsubscribe = subscribe(scraperId, send);
		const ping = setInterval(() => {
			void stream.write(": ping\n\n");
			void touchLastSeen(scraperId);
		}, SSE_PING_INTERVAL_MS);

		stream.onAbort(() => {
			clearInterval(ping);
			unsubscribe();
			resolveDone();
		});

		for (const row of replay) {
			const live = row.status === "pending" ? await claimCommand(row.id) : row;
			if (live) send(live);
		}

		// Anything inserted between the replay select and the subscription.
		await deliverPending(scraperId);

		await done;
	});
}

export async function handleCommandAck(c: Context): Promise<Response> {
	const authed = await authenticateSidecar(c);
	if (authed instanceof Response) return authed;

	let body: { id?: string };
	try {
		body = (await c.req.json()) as { id?: string };
	} catch {
		return c.text("Invalid JSON", 400);
	}
	if (!body.id) return c.text("Missing command id", 400);

	const acked = await db
		.update(scraperCommands)
		.set({ status: "completed", finishedAt: new Date() })
		.where(
			and(
				eq(scraperCommands.id, body.id),
				eq(scraperCommands.scraperId, authed.scraperId),
				eq(scraperCommands.status, "delivered"),
			),
		)
		.returning({ id: scraperCommands.id });

	return c.json({ ok: acked.length > 0 });
}
