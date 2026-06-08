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
	scraperCommands,
	scraperStatus,
	scrapers,
	sql,
	torrents,
} from "@project-minato/db";
import { communityScrapersDir } from "@project-minato/env/paths";
import {
	SCRAPER_CONTROL_JOBS,
	scraperControlQueue,
} from "@project-minato/queue";
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

		if (current?.manifest?.scraperType && current.manifest.scraperType !== input.lifecycle) {
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

	updateSchedule: scraperUpdateScheduleContract.handler(async ({ input }) => {
		await db
			.update(scrapers)
			.set({ schedule: input.schedule, updatedAt: new Date() })
			.where(eq(scrapers.id, input.id));
		return { ok: true as const };
	}),

	setEnabled: scraperSetEnabledContract.handler(async ({ input }) => {
		await db
			.update(scrapers)
			.set({ enabled: input.enabled, updatedAt: new Date() })
			.where(eq(scrapers.id, input.id));

		if (input.enabled) {
			await scraperControlQueue.add(SCRAPER_CONTROL_JOBS.ENABLE, {
				scraperId: input.id,
			});
		} else {
			await db.delete(scraperStatus).where(eq(scraperStatus.scraperId, input.id));
			await db
				.update(scrapers)
				.set({ nextRunAt: null, updatedAt: new Date() })
				.where(eq(scrapers.id, input.id));

			// Tell the supervisor to kill the process directly. The supervisor's
			// onChildExit will see enabled=false and keep the state as stopped.
			await scraperControlQueue.add(SCRAPER_CONTROL_JOBS.KILL, {
				scraperId: input.id,
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

	update: scraperUpdateContract.handler(async ({ input }) => {
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

		// Tell the supervisor to reload: kill the running process and immediately
		// respawn it so the new code is picked up right away.
		await scraperControlQueue.add(SCRAPER_CONTROL_JOBS.RELOAD, {
			scraperId: input.id,
		});

		return { ok: true as const };
	}),

	remove: scraperRemoveContract.handler(async ({ input }) => {
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

		await db
			.update(scrapers)
			.set({ state: "uninstalling", updatedAt: new Date() })
			.where(eq(scrapers.id, input.id));

		// Delete the directory first. The supervisor's community-dir watcher fires
		// handleHotRemove which kills the running process gracefully. Bun/Node
		// processes keep their already-loaded modules in memory, so deleting the
		// source tree mid-run is safe — the watcher's 300ms debounce gives enough
		// time before the SIGTERM lands.
		const dir = join(communityScrapersDir, input.id);
		if (existsSync(dir)) await rm(dir, { recursive: true, force: true });

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
				.select({ id: scrapers.id, state: scrapers.state })
				.from(scrapers)
				.where(eq(scrapers.id, input.id))
				.limit(1);

			if (!target) {
				throw new ORPCError("NOT_FOUND", {
					message: `Unknown scraper: ${input.id}`,
				});
			}

			const commandableStates = new Set(["running", "paused", "starting"]);
			if (!commandableStates.has(target.state)) {
				throw new ORPCError("BAD_REQUEST", {
					message: `Scraper is ${target.state} — cannot issue commands in this state`,
				});
			}

			const [inserted] = await db
				.insert(scraperCommands)
				.values({
					scraperId: input.id,
					command: input.command,
					issuedBy: context.session?.user?.id ?? null,
				})
				.returning({ id: scraperCommands.id });

			if (!inserted) {
				throw new ORPCError("INTERNAL_SERVER_ERROR", {
					message: "Failed to insert command",
				});
			}

			const jobName =
				input.command === "stop"
					? SCRAPER_CONTROL_JOBS.STOP
					: input.command === "pause"
						? SCRAPER_CONTROL_JOBS.PAUSE
						: SCRAPER_CONTROL_JOBS.RESUME;

			await scraperControlQueue.add(jobName, {
				scraperId: input.id,
				commandId: inserted.id,
			});

			return { commandId: inserted.id };
		},
	),

	runNow: scraperRunNowContract.handler(async ({ input }) => {
		const [row] = await db
			.select({ enabled: scrapers.enabled, state: scrapers.state })
			.from(scrapers)
			.where(eq(scrapers.id, input.id))
			.limit(1);

		if (!row) {
			throw new ORPCError("NOT_FOUND", {
				message: `Unknown scraper: ${input.id}`,
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

		await scraperControlQueue.add(SCRAPER_CONTROL_JOBS.RUN, {
			scraperId: input.id,
		});

		return { queued: true };
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
