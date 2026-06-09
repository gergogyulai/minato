// The supervisor's end of the scraper command channel. The server inserts
// command rows and NOTIFYs; this module wakes up, claims rows targeted at
// managed scrapers with a status CAS, and dispatches them into the owning
// scraper's mailbox. A periodic sweep expires stale rows and re-delivers
// pendings, so a missed NOTIFY can delay a command but never lose it.

import {
	and,
	asc,
	db,
	eq,
	gt,
	inArray,
	listenScraperCommands,
	lt,
	type ScraperCommand,
	scraperCommands,
	scrapers,
} from "@project-minato/db";
import { logger as rootLogger } from "@project-minato/utils/logger";
import { dispatch, managed } from "./supervisor";

const logger = rootLogger.child({ component: "scraper-commands" });

const SWEEP_INTERVAL_MS = 60_000;

let listener: { close(): Promise<void> } | null = null;
let sweepTimer: ReturnType<typeof setInterval> | null = null;

export async function completeCommand(id: string): Promise<void> {
	await db
		.update(scraperCommands)
		.set({ status: "completed", finishedAt: new Date() })
		.where(
			and(eq(scraperCommands.id, id), eq(scraperCommands.status, "delivered")),
		);
}

export async function failCommand(id: string, error: string): Promise<void> {
	await db
		.update(scraperCommands)
		.set({ status: "failed", error, finishedAt: new Date() })
		.where(
			and(
				eq(scraperCommands.id, id),
				inArray(scraperCommands.status, ["pending", "delivered"]),
			),
		);
}

// pending → delivered, atomically. Zero rows back means someone else claimed
// it or it expired — either way it's not ours to execute.
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

async function deliverPendingFor(scraperId: string): Promise<void> {
	if (!managed.has(scraperId)) {
		// Sidecar commands are delivered by the server's SSE stream; anything
		// else targets a scraper this supervisor doesn't know — fail it loudly
		// rather than letting it rest as pending.
		const [row] = await db
			.select({ source: scrapers.source })
			.from(scrapers)
			.where(eq(scrapers.id, scraperId))
			.limit(1);
		if (row?.source.kind === "sidecar") return;
		await db
			.update(scraperCommands)
			.set({
				status: "failed",
				error: "scraper not managed",
				finishedAt: new Date(),
			})
			.where(
				and(
					eq(scraperCommands.scraperId, scraperId),
					eq(scraperCommands.status, "pending"),
				),
			);
		return;
	}

	const pending = await db
		.select()
		.from(scraperCommands)
		.where(
			and(
				eq(scraperCommands.scraperId, scraperId),
				eq(scraperCommands.status, "pending"),
			),
		)
		.orderBy(asc(scraperCommands.createdAt));

	for (const row of pending) {
		const claimed = await claimCommand(row.id);
		if (claimed) dispatch(scraperId, { kind: "command", row: claimed });
	}
}

async function sweep(): Promise<void> {
	await db
		.update(scraperCommands)
		.set({ status: "expired", finishedAt: new Date() })
		.where(
			and(
				inArray(scraperCommands.status, ["pending", "delivered"]),
				lt(scraperCommands.expiresAt, new Date()),
			),
		);

	const stale = await db
		.selectDistinct({ scraperId: scraperCommands.scraperId })
		.from(scraperCommands)
		.where(eq(scraperCommands.status, "pending"));
	for (const { scraperId } of stale) {
		await deliverPendingFor(scraperId);
	}
}

export function startCommandChannel(): void {
	listener = listenScraperCommands((scraperId) => {
		void deliverPendingFor(scraperId).catch((err) => {
			logger.error(`deliver for ${scraperId} failed: ${(err as Error).message}`);
		});
	});
	sweepTimer = setInterval(() => {
		void sweep().catch((err) => {
			logger.error(`sweep failed: ${(err as Error).message}`);
		});
	}, SWEEP_INTERVAL_MS);
	void sweep().catch((err) => {
		logger.error(`startup sweep failed: ${(err as Error).message}`);
	});
	logger.info("Command channel started");
}

export async function stopCommandChannel(): Promise<void> {
	if (sweepTimer) clearInterval(sweepTimer);
	sweepTimer = null;
	await listener?.close();
	listener = null;
}
