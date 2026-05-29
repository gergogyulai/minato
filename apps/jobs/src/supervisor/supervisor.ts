// The supervisor's brain — everything that's not pure filesystem I/O or
// child-process plumbing lives here: the in-memory registry of managed
// scrapers, the state machine that drives transitions, the single DB
// state writer, the timer-owning scheduler, the command-ack poller, and
// the orchestration that ties it all together.

import { CronExpressionParser } from "cron-parser";
import {
  db,
  scrapers,
  scraperCommands,
  scraperStatus,
  eq,
  and,
  inArray,
  isNull,
  type Scraper,
  type ScraperState,
  type ScraperSource,
} from "@project-minato/db";
import { getConfig } from "@project-minato/config";
import { logger as rootLogger } from "@/utils/logger";

const logger = rootLogger.child({ component: 'supervisor' });
import {
  spawnScraper,
  installDependencies,
  type ChildHandle,
  type ScraperManifest,
} from "./process";
import {
  readManifest,
  discoverAll,
  watchCommunityDir,
} from "./discovery";
import type { FSWatcher } from "node:fs";

const API_URL = process.env.MINATO_API_URL ?? "http://localhost:3000";
const BACKOFF_BASE_MS = 1_000;
const BACKOFF_MAX_MS = 30_000;
const ACK_POLL_INTERVAL_MS = 5_000;

// ---------------------------------------------------------------------------
// Registry & state
// ---------------------------------------------------------------------------

type ManagedScraper = {
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

const managed = new Map<string, ManagedScraper>();
const timers = new Map<string, { timeout: ReturnType<typeof setTimeout>; fireAt: Date }>();
let watcher: FSWatcher | null = null;
let ackTimer: ReturnType<typeof setInterval> | null = null;
let stopping = false;

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

// ---------------------------------------------------------------------------
// Key provisioning
// ---------------------------------------------------------------------------

// Calls the server's internal ensure-key endpoint, which (re-)issues a
// better-auth API key with `metadata.scraperId` and upserts the scrapers
// row. Called once per scraper at startup — better-auth doesn't expose
// stored raw keys, so on each supervisor restart the key is re-issued.
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

  const res = await fetch(`${API_URL}/api/v1/internal/scraper/ensure-key`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Supervisor-Secret": secret,
    },
    body: JSON.stringify({ scraperId: manifest.id, manifest, source }),
  });

  if (!res.ok) {
    throw new Error(
      `[supervisor] ensure-key for ${manifest.id} failed: ${res.status} ${await res.text()}`,
    );
  }

  const body = (await res.json()) as { apiKey: string };
  return body.apiKey;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

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

  for (const d of discoverAll(internalDir, communityDir)) {
    try {
      await onboard(d.dir, d.type, d.manifest, d.source);
    } catch (err) {
      logger.error(
        `Failed to onboard ${d.manifest.id}: ${(err as Error).message}`,
      );
    }
  }

  watcher = watchCommunityDir(communityDir, {
    onAdded: (dir) => void handleHotAdd(dir),
    onRemoved: (dir) => void handleHotRemove(dir),
  });
  if (watcher) logger.info(`Watching community scrapers at ${communityDir}`);

  ackTimer = setInterval(() => {
    pollCommandAcks().catch((err) =>
      logger.warn(`[supervisor] ack poll failed: ${(err as Error).message}`),
    );
  }, ACK_POLL_INTERVAL_MS);
}

export async function stopAll(): Promise<void> {
  stopping = true;
  watcher?.close();
  if (ackTimer) {
    clearInterval(ackTimer);
    ackTimer = null;
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
  await installDependencies(dir, type, manifest);

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
    .select({ enabled: scrapers.enabled })
    .from(scrapers)
    .where(eq(scrapers.id, manifest.id))
    .limit(1);

  if (!dbRow?.enabled) {
    await setState(manifest.id, "stopped", { reason: "disabled" });
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

async function spawnManaged(record: ManagedScraper): Promise<void> {
  if (record.proc) return;
  if (stopping) return;

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

async function killManaged(record: ManagedScraper): Promise<void> {
  cancelTimer(record.id);
  if (!record.proc) return;
  await record.proc.killGracefully();
  record.proc = null;
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

  if (cleanExit && dbRow.lifecycle === "scheduled") {
    record.restarts = 0;
    if (cron) {
      try {
        const next = CronExpressionParser.parse(cron, { tz: "UTC" })
          .next()
          .toDate();
        await setState(record.id, "scheduled", {
          reason: `next run @ ${next.toISOString()}`,
          pid: null,
        });
        scheduleAt(record.id, next, () => {
          const current = managed.get(record.id);
          if (current && !stopping) void spawnManaged(current);
        });
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

// ---------------------------------------------------------------------------
// Command acknowledgement
// ---------------------------------------------------------------------------

// Watches for delivered-but-not-acked commands and marks them acknowledged
// once the scraper's reported phase aligns with the command. SSE delivery
// only proves the child received the bytes; this is the positive signal
// that the child acted on it.
async function pollCommandAcks(): Promise<void> {
  const pending = await db
    .select({
      id: scraperCommands.id,
      scraperId: scraperCommands.scraperId,
      command: scraperCommands.command,
      deliveredAt: scraperCommands.deliveredAt,
    })
    .from(scraperCommands)
    .where(
      and(
        eq(scraperCommands.status, "delivered"),
        isNull(scraperCommands.ackedAt),
      ),
    );

  if (pending.length === 0) return;

  const scraperIds = [...new Set(pending.map((p) => p.scraperId))];
  const statuses = await db
    .select({
      scraperId: scraperStatus.scraperId,
      phase: scraperStatus.phase,
      reportedAt: scraperStatus.reportedAt,
    })
    .from(scraperStatus)
    .where(inArray(scraperStatus.scraperId, scraperIds));

  const phaseByScraper = new Map(statuses.map((s) => [s.scraperId, s]));

  for (const cmd of pending) {
    const reported = phaseByScraper.get(cmd.scraperId);
    if (!reported) continue;
    if (cmd.deliveredAt && reported.reportedAt < cmd.deliveredAt) continue;

    const matches =
      (cmd.command === "pause" && reported.phase === "paused") ||
      (cmd.command === "resume" && reported.phase === "running") ||
      (cmd.command === "stop" && reported.phase === "idle");

    if (matches) {
      await db
        .update(scraperCommands)
        .set({ status: "acked", ackedAt: new Date() })
        .where(eq(scraperCommands.id, cmd.id));
      logger.info(`command ${cmd.id} (${cmd.command}) acked by ${cmd.scraperId}`);
    }
  }
}
