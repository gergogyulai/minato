import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { ORPCError } from "@orpc/server";
import { auth } from "@project-minato/auth";
import { getConfig } from "@project-minato/config";
import {
	db,
	eq,
	scraperCommands,
	scraperStatus,
	scrapers,
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
	scraperStatusContract,
	scraperUpdateConfigContract,
	scraperUpdateContract,
	scraperUpdateScheduleContract,
} from "@/api/contracts/scraper.contracts";
import { publishCommand } from "@/scraper/commands-pubsub";

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

		await db
			.update(scrapers)
			.set({
				pid: input.pid,
				installedVersion: input.version,
				lifecycle: input.lifecycle,
				recommendedSchedule: input.recommendedSchedule ?? null,
				state: "running",
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

		if (!input.enabled) {
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

		// Tell the supervisor to kill the process. The supervisor's filesystem
		// watcher will react to the directory removal below and clean up its
		// in-memory state.
		await scraperControlQueue.add(SCRAPER_CONTROL_JOBS.KILL, {
			scraperId: input.id,
		});

		// Brief grace window for the supervisor to kill the process before we
		// delete the directory from under it.
		await new Promise((r) => setTimeout(r, 1_000));

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
				.select({ id: scrapers.id })
				.from(scrapers)
				.where(eq(scrapers.id, input.id))
				.limit(1);

			if (!target) {
				throw new ORPCError("NOT_FOUND", {
					message: `Unknown scraper: ${input.id}`,
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

			publishCommand(input.id, { id: inserted.id, command: input.command });

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
};
