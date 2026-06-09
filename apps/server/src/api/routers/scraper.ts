import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { asc } from "drizzle-orm";
import { ORPCError } from "@orpc/server";
import { auth } from "@project-minato/auth";
import { getConfig } from "@project-minato/config";
import {
	db,
	eq,
	issueScraperCommand,
	scraperCommands,
	scraperStatus,
	scrapers,
	sql,
	torrents,
} from "@project-minato/db";
import { communityScrapersDir } from "@project-minato/env/paths";
import {
	scraperGetContract,
	scraperInstallFromRegistryContract,
	scraperInstallFromUrlContract,
	scraperIssueCommandContract,
	scraperListContract,
	scraperRegisterContract,
	scraperRemoveContract,
	scraperRunNowContract,
	scraperSetEnabledContract,
	scraperStatsContract,
	scraperStatusContract,
	scraperUpdateConfigContract,
	scraperUpdateContract,
	scraperUpdateScheduleContract,
} from "@/api/contracts/scraper.contracts";

const ALLOWED_GIT_HOSTS = new Set([
	"github.com",
	"gitlab.com",
	"codeberg.org",
	"bitbucket.org",
]);

const REGISTRY_BASE_URL = "https://github.com/minato-registry";

// A sidecar that hasn't been heard from (status post or SSE ping) within this
// window is considered offline.
const SIDECAR_LIVE_WINDOW_MS = 90_000;

function isLive(lastSeenAt: Date | null): boolean {
	return !!lastSeenAt && Date.now() - lastSeenAt.getTime() < SIDECAR_LIVE_WINDOW_MS;
}

// The remove flow hands the kill to the supervisor and waits for the command
// to settle; the timeout covers the jobs app being down, in which case the
// cleanup proceeds anyway (nothing is running that could be killed).
const REMOVE_SETTLE_TIMEOUT_MS = 10_000;

async function waitForCommandSettled(commandId: string): Promise<void> {
	const deadline = Date.now() + REMOVE_SETTLE_TIMEOUT_MS;
	while (Date.now() < deadline) {
		const [row] = await db
			.select({ status: scraperCommands.status })
			.from(scraperCommands)
			.where(eq(scraperCommands.id, commandId))
			.limit(1);
		if (!row || (row.status !== "pending" && row.status !== "delivered")) {
			return;
		}
		await new Promise((r) => setTimeout(r, 250));
	}
}

function repoDirFromUrl(url: string): string {
	const parsed = new URL(url);
	const last = parsed.pathname.split("/").filter(Boolean).pop() ?? "";
	return last.replace(/\.git$/i, "");
}

async function runGit(args: string[], cwd: string): Promise<void> {
	await new Promise<void>((resolve, reject) => {
		const child = spawn("git", args, { cwd, stdio: "pipe" });
		let stderr = "";
		child.stderr.on("data", (chunk) => {
			stderr += chunk.toString();
		});
		child.on("error", reject);
		child.on("exit", (code) => {
			if (code === 0) resolve();
			else reject(new Error(`git ${args.join(" ")} exited ${code}: ${stderr}`));
		});
	});
}

async function cloneCommunityScraper(
	url: string,
	ref: string | undefined,
): Promise<string> {
	const parsed = new URL(url);
	if (!ALLOWED_GIT_HOSTS.has(parsed.hostname)) {
		throw new ORPCError("BAD_REQUEST", {
			message: `Host not allowed: ${parsed.hostname}. Allowed: ${[...ALLOWED_GIT_HOSTS].join(", ")}`,
		});
	}

	const repoDir = repoDirFromUrl(url);
	if (!repoDir) {
		throw new ORPCError("BAD_REQUEST", {
			message: `Could not infer directory name from URL: ${url}`,
		});
	}

	const targetDir = join(communityScrapersDir, repoDir);
	if (existsSync(targetDir)) {
		throw new ORPCError("CONFLICT", {
			message: `Directory already exists: ${targetDir}`,
		});
	}

	const args = ["clone", "--depth=1"];
	if (ref) args.push("--branch", ref);
	args.push(url, targetDir);
	await runGit(args, communityScrapersDir);

	return repoDir;
}

export const scraperRouter = {
	// ----- scraperProcedure ------------------------------------------------

	register: scraperRegisterContract.handler(async ({ input, context }) => {
		const { scraperId } = context;

		const [current] = await db
			.select({ manifest: scrapers.manifest })
			.from(scrapers)
			.where(eq(scrapers.id, scraperId))
			.limit(1);

		if (!current) {
			// Supervisor-managed scrapers get their row from ensure-key before
			// they ever run; a registration without a row is a sidecar announcing
			// itself for the first time.
			const keyMeta = context.apiKey?.metadata as { type?: string } | null;
			if (keyMeta?.type !== "sidecar") {
				throw new ORPCError("NOT_FOUND", {
					message: `Unknown scraper: ${scraperId}`,
				});
			}
			const name = input.name ?? scraperId;
			await db.insert(scrapers).values({
				id: scraperId,
				name,
				apiKeyId: context.apiKey?.id ?? "",
				source: { kind: "sidecar" },
				installedVersion: input.version,
				manifest: {
					id: scraperId,
					name,
					version: input.version,
					entry: "",
					capabilities: input.capabilities,
					scraperType: input.lifecycle,
				},
				state: "running",
				enabled: true,
			});
		} else if (
			current.manifest?.scraperType &&
			current.manifest.scraperType !== input.lifecycle
		) {
			throw new ORPCError("BAD_REQUEST", {
				message: `Type mismatch: package.json declares minato.type "${current.manifest.scraperType}" but source exports lifecycle "${input.lifecycle}". Fix the factory function or the minato.type field.`,
			});
		}

		await db
			.update(scrapers)
			.set({
				pid: input.pid,
				installedVersion: input.version,
				lifecycle: input.lifecycle,
				recommendedSchedule: input.recommendedSchedule ?? null,
				...(input.name ? { name: input.name } : {}),
				lastError: null,
				lastSeenAt: new Date(),
				updatedAt: new Date(),
			})
			.where(eq(scrapers.id, scraperId));

		const cfg = getConfig();
		const [row] = await db
			.select({ config: scrapers.config })
			.from(scrapers)
			.where(eq(scrapers.id, scraperId))
			.limit(1);

		return {
			config: row?.config ?? {},
			flareSolverrUrl: cfg.scraper.flareSolverrUrl,
		};
	}),

	status: scraperStatusContract.handler(async ({ input, context }) => {
		const { scraperId } = context;
		const now = new Date();

		await db
			.insert(scraperStatus)
			.values({
				scraperId,
				phase: input.phase ?? null,
				progressCurrent: input.progress?.current ?? null,
				progressTotal: input.progress?.total ?? null,
				message: input.message ?? null,
				reportedAt: now,
			})
			.onConflictDoUpdate({
				target: scraperStatus.scraperId,
				set: {
					phase: input.phase ?? null,
					progressCurrent: input.progress?.current ?? null,
					progressTotal: input.progress?.total ?? null,
					message: input.message ?? null,
					reportedAt: now,
				},
			});

		await db
			.update(scrapers)
			.set({ lastSeenAt: now })
			.where(eq(scrapers.id, scraperId));

		return { ok: true as const };
	}),

	// ----- adminProcedure --------------------------------------------------

	list: scraperListContract.handler(async () => {
		const rows = await db.query.scrapers.findMany({
			with: { statusReport: true },
			orderBy: asc(scrapers.name),
		});

		return {
			scrapers: rows.map((r) => ({
				id: r.id,
				name: r.name,
				apiKeyId: r.apiKeyId,
				source: r.source,
				kind: r.source.kind === "sidecar" ? ("sidecar" as const) : ("managed" as const),
				live: isLive(r.lastSeenAt),
				installedVersion: r.installedVersion,
				manifest: r.manifest,
				lifecycle: r.lifecycle,
				recommendedSchedule: r.recommendedSchedule,
				schedule: r.schedule,
				config: r.config,
				enabled: r.enabled,
				state: r.state,
				pid: r.pid,
				lastError: r.lastError,
				installedAt: r.installedAt,
				updatedAt: r.updatedAt,
				lastSeenAt: r.lastSeenAt,
				status: r.statusReport
					? {
							scraperId: r.statusReport.scraperId,
							phase: r.statusReport.phase,
							progressCurrent: r.statusReport.progressCurrent,
							progressTotal: r.statusReport.progressTotal,
							message: r.statusReport.message,
							reportedAt: r.statusReport.reportedAt,
						}
					: null,
			})),
		};
	}),

	get: scraperGetContract.handler(async ({ input }) => {
		const row = await db.query.scrapers.findFirst({
			where: eq(scrapers.id, input.id),
			with: { statusReport: true },
		});
		if (!row) {
			throw new ORPCError("NOT_FOUND", {
				message: `Unknown scraper: ${input.id}`,
			});
		}

		return {
			id: row.id,
			name: row.name,
			apiKeyId: row.apiKeyId,
			source: row.source,
			kind:
				row.source.kind === "sidecar"
					? ("sidecar" as const)
					: ("managed" as const),
			live: isLive(row.lastSeenAt),
			installedVersion: row.installedVersion,
			manifest: row.manifest,
			lifecycle: row.lifecycle,
			recommendedSchedule: row.recommendedSchedule,
			schedule: row.schedule,
			config: row.config,
			enabled: row.enabled,
			state: row.state,
			pid: row.pid,
			lastError: row.lastError,
			installedAt: row.installedAt,
			updatedAt: row.updatedAt,
			lastSeenAt: row.lastSeenAt,
			status: row.statusReport
				? {
						scraperId: row.statusReport.scraperId,
						phase: row.statusReport.phase,
						progressCurrent: row.statusReport.progressCurrent,
						progressTotal: row.statusReport.progressTotal,
						message: row.statusReport.message,
						reportedAt: row.statusReport.reportedAt,
					}
				: null,
		};
	}),

	updateConfig: scraperUpdateConfigContract.handler(async ({ input }) => {
		const [existing] = await db
			.select({ manifest: scrapers.manifest })
			.from(scrapers)
			.where(eq(scrapers.id, input.id))
			.limit(1);

		if (!existing) {
			throw new ORPCError("NOT_FOUND", {
				message: `Unknown scraper: ${input.id}`,
			});
		}

		// Reject keys outside the manifest's defaultConfig so silent typos don't
		// become dead config. Skip the check entirely if no defaultConfig was
		// declared — the scraper accepts arbitrary config.
		const allowedKeys = new Set(
			Object.keys(existing.manifest.defaultConfig ?? {}),
		);
		if (allowedKeys.size > 0) {
			const unknown = Object.keys(input.config).filter(
				(k) => !allowedKeys.has(k),
			);
			if (unknown.length > 0) {
				throw new ORPCError("BAD_REQUEST", {
					message: `Unknown config keys: ${unknown.join(", ")}`,
				});
			}
		}

		await db
			.update(scrapers)
			.set({ config: input.config, updatedAt: new Date() })
			.where(eq(scrapers.id, input.id));

		return { ok: true as const };
	}),

	updateSchedule: scraperUpdateScheduleContract.handler(
		async ({ input, context }) => {
			const [row] = await db
				.select({ source: scrapers.source })
				.from(scrapers)
				.where(eq(scrapers.id, input.id))
				.limit(1);
			if (!row) {
				throw new ORPCError("NOT_FOUND", {
					message: `Unknown scraper: ${input.id}`,
				});
			}

			await db
				.update(scrapers)
				.set({ schedule: input.schedule, updatedAt: new Date() })
				.where(eq(scrapers.id, input.id));

			if (row.source.kind !== "sidecar") {
				await issueScraperCommand({
					scraperId: input.id,
					command: "sync",
					issuedBy: context.session?.user?.id ?? null,
				});
			}
			return { ok: true as const };
		},
	),

	setEnabled: scraperSetEnabledContract.handler(async ({ input, context }) => {
		const [row] = await db
			.select({ source: scrapers.source })
			.from(scrapers)
			.where(eq(scrapers.id, input.id))
			.limit(1);
		if (!row) {
			throw new ORPCError("NOT_FOUND", {
				message: `Unknown scraper: ${input.id}`,
			});
		}

		await db
			.update(scrapers)
			.set({ enabled: input.enabled, updatedAt: new Date() })
			.where(eq(scrapers.id, input.id));

		// The supervisor converges the runtime to the new desired state — kill
		// and status cleanup on disable, schedule/spawn on enable.
		if (row.source.kind !== "sidecar") {
			await issueScraperCommand({
				scraperId: input.id,
				command: "sync",
				issuedBy: context.session?.user?.id ?? null,
			});
		}

		return { ok: true as const };
	}),

	installFromUrl: scraperInstallFromUrlContract.handler(async ({ input }) => {
		const repoDir = await cloneCommunityScraper(input.url, input.ref);
		return { scraperId: repoDir };
	}),

	installFromRegistry: scraperInstallFromRegistryContract.handler(
		async ({ input }) => {
			// Registry resolution: for now, the registry is the github.com/minato-registry
			// org. Each scraper is a repo named after its slug. A real registry
			// service (a JSON manifest at a known URL) can replace this lookup later.
			const url = `${REGISTRY_BASE_URL}/${input.slug}`;
			const repoDir = await cloneCommunityScraper(url, undefined);
			return { scraperId: repoDir };
		},
	),

	update: scraperUpdateContract.handler(async ({ input, context }) => {
		const [row] = await db
			.select({ source: scrapers.source })
			.from(scrapers)
			.where(eq(scrapers.id, input.id))
			.limit(1);

		if (!row) {
			throw new ORPCError("NOT_FOUND", {
				message: `Unknown scraper: ${input.id}`,
			});
		}
		if (row.source.kind !== "git" && row.source.kind !== "registry") {
			throw new ORPCError("BAD_REQUEST", {
				message: "First-party scrapers cannot be updated through this endpoint",
			});
		}

		const dir = join(communityScrapersDir, input.id);
		if (!existsSync(dir)) {
			throw new ORPCError("NOT_FOUND", {
				message: `Source directory missing: ${dir}`,
			});
		}

		await runGit(["pull", "--ff-only"], dir);

		await issueScraperCommand({
			scraperId: input.id,
			command: "reload",
			issuedBy: context.session?.user?.id ?? null,
		});

		return { ok: true as const };
	}),

	remove: scraperRemoveContract.handler(async ({ input, context }) => {
		const [row] = await db
			.select()
			.from(scrapers)
			.where(eq(scrapers.id, input.id))
			.limit(1);

		if (!row) {
			throw new ORPCError("NOT_FOUND", {
				message: `Unknown scraper: ${input.id}`,
			});
		}
		if (row.source.kind === "first_party") {
			throw new ORPCError("BAD_REQUEST", {
				message: "First-party scrapers cannot be removed",
			});
		}

		// Managed scrapers: the supervisor kills the process and drops it from
		// its registry before any files disappear under it.
		if (row.source.kind !== "sidecar") {
			const commandId = await issueScraperCommand({
				scraperId: input.id,
				command: "remove",
				issuedBy: context.session?.user?.id ?? null,
			});
			await waitForCommandSettled(commandId);

			const dir = join(communityScrapersDir, input.id);
			if (existsSync(dir)) await rm(dir, { recursive: true, force: true });
		}

		try {
			await auth.api.deleteApiKey({
				body: { keyId: row.apiKeyId },
				headers: new Headers(),
			});
		} catch (err) {
			console.warn(
				`[scraper:remove] revoke api key failed for ${input.id}:`,
				err,
			);
		}
		await db.delete(scrapers).where(eq(scrapers.id, input.id));

		return { ok: true as const };
	}),

	issueCommand: scraperIssueCommandContract.handler(
		async ({ input, context }) => {
			const [target] = await db
				.select({
					id: scrapers.id,
					state: scrapers.state,
					source: scrapers.source,
					lastSeenAt: scrapers.lastSeenAt,
				})
				.from(scrapers)
				.where(eq(scrapers.id, input.id))
				.limit(1);

			if (!target) {
				throw new ORPCError("NOT_FOUND", {
					message: `Unknown scraper: ${input.id}`,
				});
			}

			if (target.source.kind === "sidecar") {
				// The server doesn't own a sidecar's state — liveness of the
				// command channel is the only meaningful precondition.
				if (!isLive(target.lastSeenAt)) {
					throw new ORPCError("BAD_REQUEST", {
						message:
							"Sidecar is not connected — the command would expire undelivered",
					});
				}
			} else {
				const commandableStates: Record<typeof input.command, Set<string>> = {
					pause: new Set(["running", "starting", "scheduled"]),
					stop: new Set(["running", "starting", "scheduled", "paused", "error"]),
					resume: new Set(["paused"]),
				};
				if (!commandableStates[input.command].has(target.state)) {
					throw new ORPCError("BAD_REQUEST", {
						message: `Scraper is ${target.state} — cannot ${input.command} in this state`,
					});
				}
			}

			const commandId = await issueScraperCommand({
				scraperId: input.id,
				command: input.command,
				issuedBy: context.session?.user?.id ?? null,
			});

			return { commandId };
		},
	),

	runNow: scraperRunNowContract.handler(async ({ input, context }) => {
		const [row] = await db
			.select({
				enabled: scrapers.enabled,
				state: scrapers.state,
				source: scrapers.source,
			})
			.from(scrapers)
			.where(eq(scrapers.id, input.id))
			.limit(1);

		if (!row) {
			throw new ORPCError("NOT_FOUND", {
				message: `Unknown scraper: ${input.id}`,
			});
		}
		if (row.source.kind === "sidecar") {
			throw new ORPCError("BAD_REQUEST", {
				message: "Sidecar scrapers own their schedule and cannot be triggered",
			});
		}
		if (!row.enabled) {
			throw new ORPCError("BAD_REQUEST", {
				message: "Cannot run a disabled scraper",
			});
		}

		const nonRunnable = new Set([
			"running",
			"starting",
			"paused",
			"installing",
			"uninstalling",
		]);
		if (nonRunnable.has(row.state)) {
			throw new ORPCError("BAD_REQUEST", {
				message: `Scraper is currently ${row.state} and cannot be triggered`,
			});
		}

		const commandId = await issueScraperCommand({
			scraperId: input.id,
			command: "run",
			issuedBy: context.session?.user?.id ?? null,
		});

		return { commandId };
	}),

	stats: scraperStatsContract.handler(async ({ input }) => {
		const [existing] = await db
			.select({ id: scrapers.id })
			.from(scrapers)
			.where(eq(scrapers.id, input.id))
			.limit(1);

		if (!existing) {
			throw new ORPCError("NOT_FOUND", {
				message: `Unknown scraper: ${input.id}`,
			});
		}

		const hours = input.hours ?? 48;

		const [yieldResult, byTypeResult, activityResult] = await Promise.all([
			db.execute<{
				total: number;
				last_24h: number;
				last_48h: number;
				last_7d: number;
			}>(sql`
				SELECT
					count(*)::int AS total,
					count(*) FILTER (WHERE created_at >= now() - interval '24 hours')::int AS last_24h,
					count(*) FILTER (WHERE created_at >= now() - interval '48 hours')::int AS last_48h,
					count(*) FILTER (WHERE created_at >= now() - interval '7 days')::int AS last_7d
				FROM ${torrents}
				WHERE sources @> jsonb_build_array(jsonb_build_object('scraper', ${input.id}::text))
			`),
			db.execute<{ type: string; count: number }>(sql`
				SELECT coalesce(type, 'unknown') AS type, count(*)::int AS count
				FROM ${torrents}
				WHERE sources @> jsonb_build_array(jsonb_build_object('scraper', ${input.id}::text))
				GROUP BY type
				ORDER BY count DESC
			`),
			db.execute<{ date: string; count: number }>(sql`
				SELECT to_char(d.hour, 'YYYY-MM-DD HH24:00') AS date,
				       count(t.info_hash)::int AS count
				FROM generate_series(
					date_trunc('hour', now()) - make_interval(hours => ${hours - 1}),
					date_trunc('hour', now()),
					interval '1 hour'
				) AS d(hour)
				LEFT JOIN ${torrents} t
					ON date_trunc('hour', t.created_at) = d.hour
					AND t.sources @> jsonb_build_array(jsonb_build_object('scraper', ${input.id}::text))
				GROUP BY d.hour
				ORDER BY d.hour
			`),
		]);

		const yieldRows = (
			(yieldResult as unknown as { rows?: unknown[] }).rows ?? yieldResult
		) as { total: number; last_24h: number; last_48h: number; last_7d: number }[];
		const byTypeRows = (
			(byTypeResult as unknown as { rows?: unknown[] }).rows ?? byTypeResult
		) as { type: string; count: number }[];
		const activityRows = (
			(activityResult as unknown as { rows?: unknown[] }).rows ?? activityResult
		) as { date: string; count: number }[];

		const y = yieldRows[0] ?? { total: 0, last_24h: 0, last_48h: 0, last_7d: 0 };

		return {
			yield: {
				total: Number(y.total),
				last24h: Number(y.last_24h),
				last48h: Number(y.last_48h),
				last7d: Number(y.last_7d),
				byType: byTypeRows.map((r) => ({
					type: r.type,
					count: Number(r.count),
				})),
			},
			activity: activityRows.map((r) => ({
				date: r.date,
				count: Number(r.count),
			})),
		};
	}),
};
