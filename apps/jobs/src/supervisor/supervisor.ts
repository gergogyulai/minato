// The supervisor's brain — everything that's not pure filesystem I/O or
// child-process plumbing lives here: the in-memory registry of managed
// scrapers, the state machine that drives transitions, the single DB
// state writer, the timer-owning scheduler, and the orchestration that
// ties it all together.

import { getConfig, onConfigChange } from "@project-minato/config";
import {
	db,
	eq,
	type Scraper,
	type ScraperSource,
	type ScraperState,
	scrapers,
} from "@project-minato/db";
import { CronExpressionParser } from "cron-parser";
import {
	NOTIFICATION_JOBS,
	notificationsQueue,
} from "@project-minato/queue";
import { logger as rootLogger } from "@project-minato/utils/logger";

const logger = rootLogger.child({ component: "supervisor" });

import type { FSWatcher } from "node:fs";
import { discoverAll, readManifest, watchCommunityDir } from "./discovery";
import { startControlWorker } from "./control-worker";
import {
	type ChildHandle,
	installDependencies,
	type ScraperManifest,
	spawnScraper,
} from "./process";

const API_URL = process.env.MINATO_API_URL ?? "http://localhost:3000";
const BACKOFF_BASE_MS = 1_000;
const BACKOFF_MAX_MS = 30_000;

// ---------------------------------------------------------------------------
// Registry & state
// ---------------------------------------------------------------------------

export type ManagedScraper = {
	id: string;
	name: string;
	type: "first_party" | "community";
	dir: string;
	manifest: ScraperManifest;
	source: ScraperSource;
	apiKey: string;
	proc: ChildHandle | null;
	restarts: number;
	state: ScraperState;
};

export const managed = new Map<string, ManagedScraper>();
const timers = new Map<
	string,
	{ timeout: ReturnType<typeof setTimeout>; fireAt: Date }
>();
let watcher: FSWatcher | null = null;
let controlWorker: ReturnType<typeof startControlWorker> | null = null;
let stopping = false;
let onboardingPromise: Promise<void> | null = null;

// Single state writer — every transition flows through here so the DB and
// the in-memory record never diverge. No other function in this module
// writes `scrapers.state`/`pid`/`lastError` directly.
async function setState(
	id: string,
	next: ScraperState,
	extra: {
		reason?: string;
		pid?: number | null;
		lastError?: string | null;
	} = {},
): Promise<void> {
	const record = managed.get(id);
	const previous = record?.state ?? null;
	if (record) record.state = next;

	const update: Partial<Scraper> = { state: next, updatedAt: new Date() };
	if (extra.pid !== undefined) update.pid = extra.pid;
	if (extra.lastError !== undefined) update.lastError = extra.lastError;

	try {
		await db.update(scrapers).set(update).where(eq(scrapers.id, id));
	} catch (err) {
		logger.error(
			`[supervisor] DB update for ${id} (${previous ?? "?"} → ${next}) failed: ${(err as Error).message}`,
		);
	}

	if (previous !== next) {
		logger.info(
			`scraper[${id}] ${previous ?? "init"} → ${next}${extra.reason ? ` (${extra.reason})` : ""}`,
		);
		void notificationsQueue.add(NOTIFICATION_JOBS.DISPATCH, {
			event: "scraper_state_changed",
			payload: {
				scraperId: id,
				scraperName: record?.name ?? id,
				fromState: previous,
				toState: next,
			},
		});
	}
}

// ---------------------------------------------------------------------------
// Timer ownership
// ---------------------------------------------------------------------------

function scheduleAt(id: string, date: Date, fn: () => void): void {
	cancelTimer(id);
	const ms = Math.max(0, date.getTime() - Date.now());
	const timeout = setTimeout(() => {
		timers.delete(id);
		fn();
	}, ms);
	timers.set(id, { timeout, fireAt: date });
}

export function cancelTimer(id: string): void {
	const t = timers.get(id);
	if (!t) return;
	clearTimeout(t.timeout);
	timers.delete(id);
}

function cancelAllTimers(): void {
	for (const t of timers.values()) clearTimeout(t.timeout);
	timers.clear();
}

function backoffMs(attempt: number): number {
	const base = Math.min(BACKOFF_BASE_MS * 2 ** attempt, BACKOFF_MAX_MS);
	// ±20% jitter — avoids synchronized restart storms across scrapers
	// crashing on the same dependency failure.
	const jitter = base * 0.2 * (Math.random() * 2 - 1);
	return Math.max(BACKOFF_BASE_MS, Math.round(base + jitter));
}

// Parses the cron expression, writes nextRunAt to DB, transitions to
// "scheduled", and arms the in-process timer. Throws on invalid cron so the
// call site can set state=error.
async function scheduleNextRun(record: ManagedScraper, cron: string): Promise<void> {
	const next = CronExpressionParser.parse(cron, { tz: "UTC" }).next().toDate();
	await db
		.update(scrapers)
		.set({ nextRunAt: next, updatedAt: new Date() })
		.where(eq(scrapers.id, record.id));
	await setState(record.id, "scheduled", {
		reason: `next run @ ${next.toISOString()}`,
		pid: null,
	});
	scheduleAt(record.id, next, () => {
		const current = managed.get(record.id);
		if (current && !stopping) void spawnManaged(current);
	});
}

// ---------------------------------------------------------------------------
// Key provisioning
// ---------------------------------------------------------------------------

// Calls the server's internal ensure-key endpoint, which (re-)issues a
// better-auth API key with `metadata.scraperId` and upserts the scrapers
// row. Called once per scraper at startup — better-auth doesn't expose
// stored raw keys, so on each supervisor restart the key is re-issued.
const ENSURE_KEY_RETRIES = 8;

async function ensureScraperKey(
	manifest: ScraperManifest,
	source: ScraperSource,
): Promise<string> {
	const secret = getConfig().internalSupervisorSecret;
	if (!secret) {
		throw new Error(
			"[supervisor] internalSupervisorSecret missing — server not started or setup incomplete",
		);
	}

	for (let attempt = 0; attempt <= ENSURE_KEY_RETRIES; attempt++) {
		let res: Response;
		try {
			res = await fetch(`${API_URL}/api/v1/internal/scraper/ensure-key`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"X-Supervisor-Secret": secret,
				},
				body: JSON.stringify({ scraperId: manifest.id, manifest, source }),
			});
		} catch {
			// fetch threw — server not reachable yet, retry with backoff
			if (attempt === ENSURE_KEY_RETRIES) {
				throw new Error(
					`[supervisor] ensure-key for ${manifest.id}: server unreachable after ${ENSURE_KEY_RETRIES + 1} attempts`,
				);
			}
			const delay = Math.min(BACKOFF_BASE_MS * 2 ** attempt, BACKOFF_MAX_MS);
			logger.warn(
				`ensure-key ${manifest.id}: server not ready, retrying in ${delay}ms (attempt ${attempt + 1}/${ENSURE_KEY_RETRIES})`,
			);
			await new Promise((r) => setTimeout(r, delay));
			continue;
		}

		if (!res.ok) {
			throw new Error(
				`[supervisor] ensure-key for ${manifest.id} failed: ${res.status} ${await res.text()}`,
			);
		}

		const body = (await res.json()) as { apiKey: string };
		return body.apiKey;
	}

	throw new Error("unreachable");
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

async function runOnboarding(
	internalDir: string,
	communityDir: string,
): Promise<void> {
	logger.info("Starting scraper onboarding");
	for (const d of discoverAll(internalDir, communityDir)) {
		try {
			await onboard(d.dir, d.type, d.manifest, d.source);
		} catch (err) {
			logger.error(
				`Failed to onboard ${d.manifest.id}: ${(err as Error).message}`,
			);
		}
	}
}

export async function start(
	internalDir: string,
	communityDir: string,
): Promise<void> {
	// Health pass: clear any stale "running" rows left behind by a crashed
	// previous supervisor — their PIDs are gone, so the row would lie.
	await db
		.update(scrapers)
		.set({ state: "stopped", pid: null, updatedAt: new Date() })
		.where(eq(scrapers.state, "running"));

	// Register a one-shot config listener so the supervisor self-starts once
	// setup completes — without requiring the bootstrap to know about this.
	const unsubscribe = onConfigChange((cfg) => {
		if (!onboardingPromise && cfg.setup.setupCompleted) {
			unsubscribe();
			onboardingPromise = runOnboarding(internalDir, communityDir);
		}
	});

	watcher = watchCommunityDir(communityDir, {
		onAdded: (dir) => void handleHotAdd(dir),
		onRemoved: (dir) => void handleHotRemove(dir),
	});
	if (watcher) logger.info(`Watching community scrapers at ${communityDir}`);

	controlWorker = startControlWorker();
	logger.info("Control worker started");

	if (getConfig().setup.setupCompleted) {
		unsubscribe();
		onboardingPromise = runOnboarding(internalDir, communityDir);
		await onboardingPromise;
	} else {
		logger.info("Setup not yet complete — supervisor waiting for setupCompleted");
	}
}

export async function stopAll(): Promise<void> {
	stopping = true;
	watcher?.close();
	if (controlWorker) {
		await controlWorker.close();
		controlWorker = null;
	}
	cancelAllTimers();
	await Promise.all([...managed.values()].map(killManaged));
}

// ---------------------------------------------------------------------------
// Lifecycle orchestration
// ---------------------------------------------------------------------------

async function onboard(
	dir: string,
	type: "first_party" | "community",
	manifest: ScraperManifest,
	source: ScraperSource,
): Promise<void> {
	await installDependencies(dir, type);

	// For community scrapers picked up by the watcher with a placeholder
	// source, preserve any existing DB row's source rather than overwriting
	// it. The install endpoint records the real source on first clone.
	let effectiveSource = source;
	if (source.kind === "git" && !source.url) {
		const [existing] = await db
			.select({ source: scrapers.source })
			.from(scrapers)
			.where(eq(scrapers.id, manifest.id))
			.limit(1);
		if (existing) effectiveSource = existing.source;
	}

	const apiKey = await ensureScraperKey(manifest, effectiveSource);

	const record: ManagedScraper = {
		id: manifest.id,
		name: manifest.title,
		type,
		dir,
		manifest,
		source: effectiveSource,
		apiKey,
		proc: null,
		restarts: 0,
		state: "ready",
	};
	managed.set(manifest.id, record);
	await setState(manifest.id, "ready", { reason: "onboarded" });

	const [dbRow] = await db
		.select({
			enabled: scrapers.enabled,
			lifecycle: scrapers.lifecycle,
			schedule: scrapers.schedule,
			recommendedSchedule: scrapers.recommendedSchedule,
			nextRunAt: scrapers.nextRunAt,
		})
		.from(scrapers)
		.where(eq(scrapers.id, manifest.id))
		.limit(1);

	if (!dbRow?.enabled) {
		await setState(manifest.id, "stopped", { reason: "disabled" });
		return;
	}

	// Restore a persisted schedule timer instead of spawning immediately.
	if (dbRow.lifecycle === "scheduled" && dbRow.nextRunAt) {
		const now = new Date();
		const cron = dbRow.schedule ?? dbRow.recommendedSchedule ?? null;

		if (dbRow.nextRunAt > now) {
			// Persisted time is still future — arm directly without updating nextRunAt.
			await setState(manifest.id, "scheduled", {
				reason: `next run @ ${dbRow.nextRunAt.toISOString()} (restored)`,
				pid: null,
			});
			scheduleAt(manifest.id, dbRow.nextRunAt, () => {
				const current = managed.get(manifest.id);
				if (current && !stopping) void spawnManaged(current);
			});
			return;
		}

		if (cron) {
			// Missed the scheduled window — advance to next occurrence from now.
			try {
				await scheduleNextRun(record, cron);
			} catch {
				await setState(manifest.id, "error", {
					reason: "invalid cron on restore",
					lastError: "cron parse error",
				});
			}
			return;
		}

		// No cron, missed run — spawn immediately.
		await spawnManaged(record);
		return;
	}

	await spawnManaged(record);
}

async function handleHotAdd(dir: string): Promise<void> {
	if (stopping) return;
	let manifest: ScraperManifest;
	try {
		manifest = readManifest(dir);
	} catch (err) {
		logger.warn(`Hot-add ${dir}: ${(err as Error).message}`);
		return;
	}

	// Already managed — manifest may have been edited. Restart with the
	// fresh manifest by stopping and re-onboarding.
	const existing = managed.get(manifest.id);
	if (existing) {
		logger.info(`Hot-reload ${manifest.id}`);
		await killManaged(existing);
		managed.delete(manifest.id);
	}
	await onboard(dir, "community", manifest, { kind: "git", url: "" });
}

async function handleHotRemove(dir: string): Promise<void> {
	const record = [...managed.values()].find((m) => m.dir === dir);
	if (!record) return;
	logger.warn(`scraper[${record.id}] directory removed — uninstalling`);
	await setState(record.id, "uninstalling", { reason: "directory removed" });
	await killManaged(record);
	managed.delete(record.id);
}

// ---------------------------------------------------------------------------
// Process control
// ---------------------------------------------------------------------------

export async function spawnManaged(record: ManagedScraper): Promise<void> {
	if (record.proc) return;
	if (stopping) return;

	await db
		.update(scrapers)
		.set({ nextRunAt: null, updatedAt: new Date() })
		.where(eq(scrapers.id, record.id));

	await setState(record.id, "starting", { reason: "spawn requested" });

	let handle: ChildHandle;
	try {
		handle = spawnScraper({
			dir: record.dir,
			manifest: record.manifest,
			apiUrl: API_URL,
			apiKey: record.apiKey,
		});
	} catch (err) {
		await setState(record.id, "error", {
			reason: "spawn failed",
			lastError: (err as Error).message,
		});
		return;
	}

	record.proc = handle;
	await setState(record.id, "running", {
		reason: "spawned",
		pid: handle.pid,
		lastError: null,
	});

	void handle.exited.then((code) => void onChildExit(record, code));
}

export async function scheduleEnabled(id: string): Promise<void> {
	const record = managed.get(id);
	if (!record) return;
	if (record.proc) return;

	const [dbRow] = await db
		.select({
			lifecycle: scrapers.lifecycle,
			schedule: scrapers.schedule,
			recommendedSchedule: scrapers.recommendedSchedule,
		})
		.from(scrapers)
		.where(eq(scrapers.id, id))
		.limit(1);

	if (!dbRow) return;

	const cron = dbRow.schedule ?? dbRow.recommendedSchedule ?? null;

	if ((dbRow.lifecycle === "scheduled" || dbRow.lifecycle === "poller") && cron) {
		try {
			await scheduleNextRun(record, cron);
		} catch (err) {
			await setState(id, "error", {
				reason: "invalid cron on enable",
				lastError: `cron parse error: ${(err as Error).message}`,
			});
		}
		return;
	}

	record.restarts = 0;
	await spawnManaged(record);
}

export async function killManaged(record: ManagedScraper): Promise<void> {
	cancelTimer(record.id);
	const proc = record.proc;
	// Null out proc and set state synchronously before awaiting killGracefully.
	// handle.exited resolves when the process exits, which is also when
	// killGracefully's internal race resolves — so onChildExit fires before
	// killGracefully returns. The synchronous update here ensures onChildExit
	// sees state="stopped" and returns early instead of scheduling a restart.
	record.proc = null;
	record.state = "stopped";
	if (proc) await proc.killGracefully();
	await setState(record.id, "stopped", { pid: null });
}

async function onChildExit(
	record: ManagedScraper,
	exitCode: number | null,
): Promise<void> {
	record.proc = null;

	const [dbRow] = await db
		.select({
			enabled: scrapers.enabled,
			lifecycle: scrapers.lifecycle,
			schedule: scrapers.schedule,
			recommendedSchedule: scrapers.recommendedSchedule,
		})
		.from(scrapers)
		.where(eq(scrapers.id, record.id))
		.limit(1);

	// Intentional teardown — keep state as-is, no rescheduling.
	if (record.state === "uninstalling" || record.state === "stopped") {
		return;
	}

	if (!dbRow?.enabled) {
		await setState(record.id, "stopped", { reason: "disabled", pid: null });
		return;
	}

	const cleanExit = exitCode === 0;
	const cron = dbRow.schedule ?? dbRow.recommendedSchedule ?? null;

	if (cleanExit && (dbRow.lifecycle === "scheduled" || dbRow.lifecycle === "poller")) {
		record.restarts = 0;
		void notificationsQueue.add(NOTIFICATION_JOBS.DISPATCH, {
			event: "scraper_completed",
			payload: { scraperId: record.id, scraperName: record.name, exitCode: 0 },
		});
		if (cron) {
			try {
				await scheduleNextRun(record, cron);
			} catch (err) {
				await setState(record.id, "error", {
					reason: "invalid cron",
					lastError: (err as Error).message,
					pid: null,
				});
			}
			return;
		}
		await setState(record.id, "stopped", {
			reason: "no schedule configured",
			pid: null,
		});
		return;
	}

	// Crash, or a daemon exiting "cleanly" (still a problem) — exponential
	// backoff with jitter.
	record.restarts += 1;
	const delay = backoffMs(record.restarts - 1);
	void notificationsQueue.add(NOTIFICATION_JOBS.DISPATCH, {
		event: "scraper_failed",
		payload: {
			scraperId: record.id,
			scraperName: record.name,
			exitCode,
			restarts: record.restarts,
		},
	});
	await setState(record.id, "error", {
		reason: `exited ${exitCode} (attempt ${record.restarts})`,
		pid: null,
		lastError: `exit code ${exitCode}`,
	});
	logger.warn(`scraper[${record.id}] restart in ${delay}ms`);
	scheduleAt(record.id, new Date(Date.now() + delay), () => {
		const current = managed.get(record.id);
		if (current && !stopping) void spawnManaged(current);
	});
}

