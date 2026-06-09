// The supervisor's brain — the in-memory registry of managed scrapers, the
// single DB state writer, the timer-owning scheduler, and the per-scraper
// mailbox that serializes every event so lifecycle decisions never interleave.
//
// Every event source — claimed commands, timer fires, child exits, fs watcher
// callbacks, onboarding — funnels through dispatch(). Inside a mailbox task
// the scraper's world is frozen: guards like `if (record.proc)` are checked
// in the serialized task, not at enqueue time, so duplicate spawns and
// teardown races are impossible by construction.

import type { FSWatcher } from "node:fs";
import { getConfig, onConfigChange } from "@project-minato/config";
import {
	db,
	eq,
	isNotNull,
	type Scraper,
	type ScraperCommand,
	type ScraperSource,
	type ScraperState,
	scraperStatus,
	scrapers,
	sql,
} from "@project-minato/db";
import {
	NOTIFICATION_JOBS,
	notificationsQueue,
} from "@project-minato/queue";
import { logger as rootLogger } from "@project-minato/utils/logger";
import { CronExpressionParser } from "cron-parser";
import {
	completeCommand,
	failCommand,
	startCommandChannel,
	stopCommandChannel,
} from "./commands";
import { discoverAll, readManifest, watchCommunityDir } from "./discovery";
import {
	type ChildHandle,
	installDependencies,
	reapStalePid,
	type ScraperManifest,
	spawnScraper,
} from "./process";

const logger = rootLogger.child({ component: "supervisor" });

const API_URL = process.env.MINATO_API_URL ?? "http://localhost:3000";
const BACKOFF_BASE_MS = 1_000;
const BACKOFF_MAX_MS = 30_000;

// ---------------------------------------------------------------------------
// Registry & events
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
	paused: boolean;
	mailbox: Promise<void>;
};

export type ScraperEvent =
	| { kind: "spawn"; reason: "schedule" | "backoff" }
	| { kind: "command"; row: ScraperCommand }
	| { kind: "exited"; handle: ChildHandle; code: number | null }
	| { kind: "manifest-changed"; dir: string }
	| { kind: "dir-removed" };

export const managed = new Map<string, ManagedScraper>();
let watcher: FSWatcher | null = null;
let stopping = false;
let onboardingPromise: Promise<void> | null = null;

function enqueue(record: ManagedScraper, task: () => Promise<void>): void {
	record.mailbox = record.mailbox.then(task).catch((err) => {
		logger.error(
			`scraper[${record.id}] task failed: ${(err as Error).message}`,
		);
	});
}

export function dispatch(id: string, event: ScraperEvent): void {
	const record = managed.get(id);
	if (!record) {
		if (event.kind === "command") {
			void failCommand(event.row.id, "scraper not managed");
		}
		return;
	}
	enqueue(record, () => handleEvent(record, event));
}

async function handleEvent(
	record: ManagedScraper,
	event: ScraperEvent,
): Promise<void> {
	switch (event.kind) {
		case "spawn":
			if (!record.paused) await spawnNow(record);
			return;
		case "command":
			await handleCommand(record, event.row);
			return;
		case "exited":
			await handleExited(record, event.handle, event.code);
			return;
		case "manifest-changed":
			await handleManifestChanged(record, event.dir);
			return;
		case "dir-removed":
			logger.warn(`scraper[${record.id}] directory removed — uninstalling`);
			await killNow(record, {
				state: "uninstalling",
				reason: "directory removed",
			});
			managed.delete(record.id);
			return;
	}
}

// ---------------------------------------------------------------------------
// Single state writer — every transition flows through here so the DB and
// the in-memory record never diverge.
// ---------------------------------------------------------------------------

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
// Timers & scheduling
// ---------------------------------------------------------------------------

const timers = new Map<
	string,
	{ timeout: ReturnType<typeof setTimeout>; fireAt: Date }
>();

function armSpawnTimer(
	id: string,
	date: Date,
	reason: "schedule" | "backoff",
): void {
	cancelTimer(id);
	const ms = Math.max(0, date.getTime() - Date.now());
	const timeout = setTimeout(() => {
		timers.delete(id);
		if (!stopping) dispatch(id, { kind: "spawn", reason });
	}, ms);
	timers.set(id, { timeout, fireAt: date });
}

function cancelTimer(id: string): void {
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

function effectiveCron(row: {
	schedule: string | null;
	recommendedSchedule: string | null;
}): string | null {
	return row.schedule ?? row.recommendedSchedule ?? null;
}

function isCronDriven(lifecycle: string | null): boolean {
	return lifecycle === "scheduled" || lifecycle === "poller";
}

async function readControlRow(id: string) {
	const [row] = await db
		.select({
			enabled: scrapers.enabled,
			state: scrapers.state,
			lifecycle: scrapers.lifecycle,
			schedule: scrapers.schedule,
			recommendedSchedule: scrapers.recommendedSchedule,
			nextRunAt: scrapers.nextRunAt,
		})
		.from(scrapers)
		.where(eq(scrapers.id, id))
		.limit(1);
	return row ?? null;
}

// Parses the cron expression, persists nextRunAt, transitions to "scheduled",
// and arms the in-process timer. Invalid cron lands the scraper in "error".
async function scheduleNextRun(
	record: ManagedScraper,
	cron: string,
): Promise<void> {
	let next: Date;
	try {
		next = CronExpressionParser.parse(cron, { tz: "UTC" }).next().toDate();
	} catch (err) {
		await setState(record.id, "error", {
			reason: "invalid cron",
			lastError: `cron parse error: ${(err as Error).message}`,
			pid: null,
		});
		return;
	}
	await db
		.update(scrapers)
		.set({ nextRunAt: next, updatedAt: new Date() })
		.where(eq(scrapers.id, record.id));
	await setState(record.id, "scheduled", {
		reason: `next run @ ${next.toISOString()}`,
		pid: null,
	});
	armSpawnTimer(record.id, next, "schedule");
}

// ---------------------------------------------------------------------------
// Process control
// ---------------------------------------------------------------------------

async function spawnNow(record: ManagedScraper): Promise<void> {
	if (record.proc || stopping) return;

	// Enabled is re-read here because a timer can fire with a disable already
	// queued behind it — the spawn must lose that race.
	const row = await readControlRow(record.id);
	if (!row?.enabled) {
		await setState(record.id, "stopped", { reason: "disabled", pid: null });
		return;
	}

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

	void handle.exited.then((code) =>
		dispatch(record.id, { kind: "exited", handle, code }),
	);
}

async function killNow(
	record: ManagedScraper,
	opts: { state?: ScraperState; reason?: string } = {},
): Promise<void> {
	cancelTimer(record.id);
	const proc = record.proc;
	record.proc = null;
	if (proc) await proc.killGracefully();
	await setState(record.id, opts.state ?? "stopped", {
		reason: opts.reason,
		pid: null,
	});
}

// Decides how an idle scraper comes (back) to life. Cron-driven scrapers are
// never spawned spontaneously: a still-future persisted timer is restored, a
// missed window advances to the next occurrence. Daemons — and fresh installs
// whose lifecycle is unknown until their first registration — spawn directly.
async function bringUp(record: ManagedScraper): Promise<void> {
	if (record.proc || record.paused || stopping) return;

	const row = await readControlRow(record.id);
	if (!row?.enabled) {
		await setState(record.id, "stopped", { reason: "disabled", pid: null });
		return;
	}

	if (isCronDriven(row.lifecycle)) {
		if (row.nextRunAt && row.nextRunAt > new Date()) {
			await setState(record.id, "scheduled", {
				reason: `next run @ ${row.nextRunAt.toISOString()} (restored)`,
				pid: null,
			});
			armSpawnTimer(record.id, row.nextRunAt, "schedule");
			return;
		}
		const cron = effectiveCron(row);
		if (cron) {
			await scheduleNextRun(record, cron);
			return;
		}
		await setState(record.id, "stopped", {
			reason: "no schedule configured",
			pid: null,
		});
		return;
	}

	await spawnNow(record);
}

// ---------------------------------------------------------------------------
// Command execution
// ---------------------------------------------------------------------------

async function handleCommand(
	record: ManagedScraper,
	row: ScraperCommand,
): Promise<void> {
	logger.info(`scraper[${record.id}] command: ${row.command}`);
	try {
		await executeCommand(record, row);
		await completeCommand(row.id);
	} catch (err) {
		logger.error(
			`scraper[${record.id}] command ${row.command} failed: ${(err as Error).message}`,
		);
		await failCommand(row.id, (err as Error).message);
	}
}

async function executeCommand(
	record: ManagedScraper,
	row: ScraperCommand,
): Promise<void> {
	switch (row.command) {
		case "run":
			if (record.proc) return; // already running — desired state met
			cancelTimer(record.id);
			record.paused = false;
			record.restarts = 0;
			await spawnNow(record);
			return;

		case "stop":
			record.paused = false;
			await killNow(record, { reason: "stop command" });
			return;

		case "pause":
			record.paused = true;
			await killNow(record, { state: "paused", reason: "pause command" });
			await persistNextRun(record);
			return;

		case "resume":
			record.paused = false;
			record.restarts = 0;
			await bringUp(record);
			return;

		case "reload": {
			const manifest = readManifest(record.dir);
			await killNow(record, { reason: "reload" });
			record.manifest = manifest;
			record.name = manifest.title;
			record.apiKey = await ensureScraperKey(manifest, record.source);
			record.restarts = 0;
			await bringUp(record);
			return;
		}

		case "sync": {
			const dbRow = await readControlRow(record.id);
			if (!dbRow?.enabled) {
				record.paused = false;
				await killNow(record, { reason: "disabled" });
				await db
					.update(scrapers)
					.set({ nextRunAt: null, updatedAt: new Date() })
					.where(eq(scrapers.id, record.id));
				await db
					.delete(scraperStatus)
					.where(eq(scraperStatus.scraperId, record.id));
				return;
			}
			// A running scraper picks up the new desired state on exit; a paused
			// one stays paused until an explicit resume.
			if (record.proc || record.paused) return;
			cancelTimer(record.id);
			await db
				.update(scrapers)
				.set({ nextRunAt: null, updatedAt: new Date() })
				.where(eq(scrapers.id, record.id));
			await bringUp(record);
			return;
		}

		case "remove":
			await killNow(record, {
				state: "uninstalling",
				reason: "remove command",
			});
			managed.delete(record.id);
			return;
	}
}

// Pause keeps the schedule recoverable across supervisor restarts: persist
// where the next run would have been, without arming a timer.
async function persistNextRun(record: ManagedScraper): Promise<void> {
	const row = await readControlRow(record.id);
	if (!row || !isCronDriven(row.lifecycle)) return;
	const cron = effectiveCron(row);
	if (!cron) return;
	try {
		const next = CronExpressionParser.parse(cron, { tz: "UTC" })
			.next()
			.toDate();
		await db
			.update(scrapers)
			.set({ nextRunAt: next, updatedAt: new Date() })
			.where(eq(scrapers.id, record.id));
	} catch {
		// invalid cron — leave nextRunAt as-is
	}
}

// ---------------------------------------------------------------------------
// Child exit
// ---------------------------------------------------------------------------

async function handleExited(
	record: ManagedScraper,
	handle: ChildHandle,
	exitCode: number | null,
): Promise<void> {
	// A kill path already nulled proc and wrote the final state — this exit
	// event is the tail of that teardown, nothing left to do.
	if (record.proc !== handle) return;
	record.proc = null;

	const row = await readControlRow(record.id);
	if (!row?.enabled) {
		await setState(record.id, "stopped", { reason: "disabled", pid: null });
		return;
	}

	if (exitCode === 0 && isCronDriven(row.lifecycle)) {
		record.restarts = 0;
		void notificationsQueue.add(NOTIFICATION_JOBS.DISPATCH, {
			event: "scraper_completed",
			payload: { scraperId: record.id, scraperName: record.name, exitCode: 0 },
		});
		const cron = effectiveCron(row);
		if (cron) {
			await scheduleNextRun(record, cron);
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
	armSpawnTimer(record.id, new Date(Date.now() + delay), "backoff");
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
// Onboarding & discovery callbacks
// ---------------------------------------------------------------------------

function onboard(
	dir: string,
	type: "first_party" | "community",
	manifest: ScraperManifest,
	source: ScraperSource,
): void {
	if (managed.has(manifest.id)) {
		dispatch(manifest.id, { kind: "manifest-changed", dir });
		return;
	}
	const record: ManagedScraper = {
		id: manifest.id,
		name: manifest.title,
		type,
		dir,
		manifest,
		source,
		apiKey: "",
		proc: null,
		restarts: 0,
		state: "installing",
		paused: false,
		mailbox: Promise.resolve(),
	};
	managed.set(record.id, record);
	enqueue(record, () => onboardTask(record));
}

async function onboardTask(record: ManagedScraper): Promise<void> {
	await installDependencies(record.dir, record.type);

	// For community scrapers picked up by the watcher with a placeholder
	// source, preserve any existing DB row's source rather than overwriting
	// it. The install endpoint records the real source on first clone.
	if (record.source.kind === "git" && !record.source.url) {
		const [existing] = await db
			.select({ source: scrapers.source })
			.from(scrapers)
			.where(eq(scrapers.id, record.id))
			.limit(1);
		if (existing) record.source = existing.source;
	}

	record.apiKey = await ensureScraperKey(record.manifest, record.source);

	// Read before any state write — a persisted "paused" must survive restarts.
	const row = await readControlRow(record.id);
	if (!row?.enabled) {
		await setState(record.id, "stopped", { reason: "disabled", pid: null });
		return;
	}
	if (row.state === "paused") {
		record.paused = true;
		await setState(record.id, "paused", { reason: "pause restored" });
		return;
	}

	await setState(record.id, "ready", { reason: "onboarded" });
	await bringUp(record);
}

async function handleManifestChanged(
	record: ManagedScraper,
	dir: string,
): Promise<void> {
	logger.info(`scraper[${record.id}] manifest changed — reloading`);
	const manifest = readManifest(dir);
	await killNow(record, { reason: "manifest changed" });
	record.dir = dir;
	record.manifest = manifest;
	record.name = manifest.title;
	record.restarts = 0;
	await onboardTask(record);
}

function handleHotAdd(dir: string): void {
	if (stopping) return;
	let manifest: ScraperManifest;
	try {
		manifest = readManifest(dir);
	} catch (err) {
		logger.warn(`Hot-add ${dir}: ${(err as Error).message}`);
		return;
	}
	onboard(dir, "community", manifest, { kind: "git", url: "" });
}

function handleHotRemove(dir: string): void {
	const record = [...managed.values()].find((m) => m.dir === dir);
	if (record) dispatch(record.id, { kind: "dir-removed" });
}

// ---------------------------------------------------------------------------
// Startup & shutdown
// ---------------------------------------------------------------------------

// Children are detached, so a crashed supervisor leaves them running. Kill
// anything a previous run left behind before taking ownership of the world.
async function reapStaleProcesses(): Promise<void> {
	const rows = await db
		.select({ id: scrapers.id, pid: scrapers.pid, source: scrapers.source })
		.from(scrapers)
		.where(isNotNull(scrapers.pid));

	const stale = rows.filter((r) => r.source.kind !== "sidecar");
	if (stale.length > 0) {
		logger.warn(`Reaping ${stale.length} stale scraper process(es)`);
		await Promise.all(stale.map((r) => reapStalePid(r.pid as number)));
	}

	await db
		.update(scrapers)
		.set({ state: "stopped", pid: null, updatedAt: new Date() })
		.where(
			sql`${scrapers.state} = 'running' AND ${scrapers.source}->>'kind' <> 'sidecar'`,
		);
	await db
		.update(scrapers)
		.set({ pid: null, updatedAt: new Date() })
		.where(
			sql`${scrapers.pid} IS NOT NULL AND ${scrapers.source}->>'kind' <> 'sidecar'`,
		);
}

async function runOnboarding(
	internalDir: string,
	communityDir: string,
): Promise<void> {
	logger.info("Starting scraper onboarding");
	for (const d of discoverAll(internalDir, communityDir)) {
		onboard(d.dir, d.type, d.manifest, d.source);
	}
	await Promise.all([...managed.values()].map((r) => r.mailbox));
	// Commands issued while the supervisor was down are still pending in the
	// table — the channel's startup sweep picks them up, so it must start
	// only after the registry is populated.
	startCommandChannel();
}

export async function start(
	internalDir: string,
	communityDir: string,
): Promise<void> {
	await reapStaleProcesses();

	// Register a one-shot config listener so the supervisor self-starts once
	// setup completes — without requiring the bootstrap to know about this.
	const unsubscribe = onConfigChange((cfg) => {
		if (!onboardingPromise && cfg.setup.setupCompleted) {
			unsubscribe();
			onboardingPromise = runOnboarding(internalDir, communityDir);
		}
	});

	watcher = watchCommunityDir(communityDir, {
		onAdded: handleHotAdd,
		onRemoved: handleHotRemove,
	});
	if (watcher) logger.info(`Watching community scrapers at ${communityDir}`);

	if (getConfig().setup.setupCompleted) {
		unsubscribe();
		onboardingPromise = runOnboarding(internalDir, communityDir);
		await onboardingPromise;
	} else {
		logger.info(
			"Setup not yet complete — supervisor waiting for setupCompleted",
		);
	}
}

export async function stopAll(): Promise<void> {
	stopping = true;
	watcher?.close();
	await stopCommandChannel();
	cancelAllTimers();
	await Promise.all(
		[...managed.values()].map((record) => {
			enqueue(record, () => killNow(record, { reason: "shutdown" }));
			return record.mailbox;
		}),
	);
}
