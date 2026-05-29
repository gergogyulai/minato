import { CronExpressionParser } from "cron-parser";
import { z } from "zod";
import { adminProcedure, scraperProcedure } from "@/api";

// -------- Shared schemas ---------------------------------------------------

const cronExpression = z
	.string()
	.min(1)
	.refine(
		(expr) => {
			try {
				CronExpressionParser.parse(expr);
				return true;
			} catch {
				return false;
			}
		},
		{ message: "Invalid cron expression (5-field UTC format required)" },
	);

const sourceSchema = z.discriminatedUnion("kind", [
	z.object({ kind: z.literal("first_party") }),
	z.object({
		kind: z.literal("git"),
		url: z.string().url(),
		ref: z.string().optional(),
	}),
	z.object({
		kind: z.literal("registry"),
		slug: z.string(),
		url: z.string().url(),
	}),
]);

const manifestSnapshotSchema = z.object({
	id: z.string(),
	name: z.string(),
	version: z.string(),
	author: z.string().optional(),
	runtime: z.enum(["bun", "node"]).optional(),
	entry: z.string(),
	capabilities: z.array(z.string()),
	defaultConfig: z.record(z.string(), z.unknown()).optional(),
});

const lifecycleSchema = z.enum(["scheduled", "daemon"]);
const stateSchema = z.enum([
	"installing",
	"ready",
	"starting",
	"running",
	"paused",
	"scheduled",
	"stopped",
	"error",
	"uninstalling",
]);
const phaseSchema = z.enum(["idle", "running", "paused", "error"]);
const commandSchema = z.enum(["pause", "stop", "resume"]);

const scraperSchema = z.object({
	id: z.string(),
	name: z.string(),
	apiKeyId: z.string(),
	source: sourceSchema,
	installedVersion: z.string(),
	manifest: manifestSnapshotSchema,
	lifecycle: lifecycleSchema.nullable(),
	recommendedSchedule: z.string().nullable(),
	schedule: z.string().nullable(),
	config: z.record(z.string(), z.unknown()),
	enabled: z.boolean(),
	state: stateSchema,
	pid: z.number().int().nullable(),
	lastError: z.string().nullable(),
	installedAt: z.date(),
	updatedAt: z.date(),
	lastSeenAt: z.date().nullable(),
});

const statusSchema = z.object({
	scraperId: z.string(),
	phase: phaseSchema.nullable(),
	progressCurrent: z.number().int().nullable(),
	progressTotal: z.number().int().nullable(),
	message: z.string().nullable(),
	reportedAt: z.date(),
});

// -------- scraperProcedure: called by running scrapers ---------------------

export const scraperRegisterContract = scraperProcedure
	.route({
		method: "POST",
		path: "/scraper/register",
		summary: "Register a scraper at process start",
		tags: ["scraper"],
	})
	.input(
		z.object({
			version: z.string(),
			pid: z.number().int(),
			capabilities: z.array(z.string()),
			lifecycle: lifecycleSchema,
			recommendedSchedule: z.string().optional(),
		}),
	)
	.output(
		z.object({
			config: z.record(z.string(), z.unknown()),
			flareSolverrUrl: z.string(),
		}),
	);

export const scraperStatusContract = scraperProcedure
	.route({
		method: "POST",
		path: "/scraper/status",
		summary: "Report scraper status",
		tags: ["scraper"],
	})
	.input(
		z.object({
			phase: phaseSchema.optional(),
			progress: z
				.object({
					current: z.number().int(),
					total: z.number().int().optional(),
				})
				.optional(),
			message: z.string().optional(),
		}),
	)
	.output(z.object({ ok: z.literal(true) }));

// -------- adminProcedure: dashboard operations -----------------------------

export const scraperListContract = adminProcedure
	.route({
		method: "GET",
		path: "/scraper",
		summary: "List installed scrapers",
		tags: ["scraper"],
	})
	.output(
		z.object({
			scrapers: z.array(
				scraperSchema.extend({ status: statusSchema.nullable() }),
			),
		}),
	);

export const scraperGetContract = adminProcedure
	.route({
		method: "GET",
		path: "/scraper/:id",
		summary: "Get one scraper with its current status",
		tags: ["scraper"],
	})
	.input(z.object({ id: z.string() }))
	.output(scraperSchema.extend({ status: statusSchema.nullable() }));

export const scraperUpdateConfigContract = adminProcedure
	.route({
		method: "POST",
		path: "/scraper/:id/config",
		summary: "Update scraper config overrides",
		tags: ["scraper"],
	})
	.input(
		z.object({
			id: z.string(),
			config: z.record(z.string(), z.unknown()),
		}),
	)
	.output(z.object({ ok: z.literal(true) }));

export const scraperUpdateScheduleContract = adminProcedure
	.route({
		method: "POST",
		path: "/scraper/:id/schedule",
		summary: "Update scraper schedule (cron)",
		tags: ["scraper"],
	})
	.input(
		z.object({
			id: z.string(),
			schedule: cronExpression.nullable(),
		}),
	)
	.output(z.object({ ok: z.literal(true) }));

export const scraperSetEnabledContract = adminProcedure
	.route({
		method: "POST",
		path: "/scraper/:id/enabled",
		summary: "Enable or disable a scraper",
		tags: ["scraper"],
	})
	.input(z.object({ id: z.string(), enabled: z.boolean() }))
	.output(z.object({ ok: z.literal(true) }));

export const scraperInstallFromUrlContract = adminProcedure
	.route({
		method: "POST",
		path: "/scraper/install/url",
		summary: "Install a community scraper from a Git URL",
		tags: ["scraper"],
	})
	.input(
		z.object({
			url: z.string().url(),
			ref: z.string().optional(),
		}),
	)
	.output(z.object({ scraperId: z.string() }));

export const scraperInstallFromRegistryContract = adminProcedure
	.route({
		method: "POST",
		path: "/scraper/install/registry",
		summary: "Install a community scraper from the registry",
		tags: ["scraper"],
	})
	.input(z.object({ slug: z.string().min(1) }))
	.output(z.object({ scraperId: z.string() }));

export const scraperUpdateContract = adminProcedure
	.route({
		method: "POST",
		path: "/scraper/:id/update",
		summary: "Pull the latest version of a scraper from its source",
		tags: ["scraper"],
	})
	.input(z.object({ id: z.string() }))
	.output(z.object({ ok: z.literal(true) }));

export const scraperRemoveContract = adminProcedure
	.route({
		method: "POST",
		path: "/scraper/:id/remove",
		summary: "Stop and uninstall a scraper",
		tags: ["scraper"],
	})
	.input(z.object({ id: z.string() }))
	.output(z.object({ ok: z.literal(true) }));

export const scraperIssueCommandContract = adminProcedure
	.route({
		method: "POST",
		path: "/scraper/:id/command",
		summary: "Issue a control command to a running scraper",
		tags: ["scraper"],
	})
	.input(
		z.object({
			id: z.string(),
			command: commandSchema,
		}),
	)
	.output(z.object({ commandId: z.string() }));
