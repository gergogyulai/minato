import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import {
	HOUSEKEEPER_JOBS,
	aiRepairQueue,
	enrichQueue,
	housekeeperQueue,
	ingestQueue,
} from "@project-minato/queue";
import { ORPCError } from "@orpc/server";
import { exportsDir } from "@project-minato/env/paths";
import { z } from "zod";
import { adminProcedure } from "@/api";

const queueCountsSchema = z.object({
	name: z.string(),
	waiting: z.number(),
	active: z.number(),
	completed: z.number(),
	failed: z.number(),
	delayed: z.number(),
	paused: z.number(),
});

const jobSchema = z.object({
	id: z.string(),
	name: z.string(),
	data: z.unknown(),
	failedReason: z.string().nullable(),
	stacktrace: z.array(z.string()).nullable(),
	timestamp: z.number(),
	processedOn: z.number().nullable(),
	finishedOn: z.number().nullable(),
	attemptsMade: z.number(),
});

const QUEUE_MAP = {
	ingest: ingestQueue,
	enrich: enrichQueue,
	housekeeper: housekeeperQueue,
	ai_repair: aiRepairQueue,
} as const;

export const queuesRouter = {
	status: adminProcedure
		.route({
			method: "GET",
			path: "/queues/status",
			summary: "BullMQ job counts per queue",
			tags: ["queues"],
		})
		.output(z.object({ queues: z.array(queueCountsSchema) }))
		.handler(async () => {
			const definitions = [
				{ name: "ingest", queue: ingestQueue },
				{ name: "enrich", queue: enrichQueue },
				{ name: "housekeeper", queue: housekeeperQueue },
				{ name: "ai_repair", queue: aiRepairQueue },
			];

			const queues = await Promise.all(
				definitions.map(async ({ name, queue }) => {
					const counts = await queue.getJobCounts(
						"waiting",
						"active",
						"completed",
						"failed",
						"delayed",
						"paused",
					);
					return {
						name,
						waiting: counts.waiting ?? 0,
						active: counts.active ?? 0,
						completed: counts.completed ?? 0,
						failed: counts.failed ?? 0,
						delayed: counts.delayed ?? 0,
						paused: counts.paused ?? 0,
					};
				}),
			);

			return { queues };
		}),

	jobs: adminProcedure
		.route({
			method: "GET",
			path: "/queues/jobs",
			summary: "Paginated job list for a queue and status",
			tags: ["queues"],
		})
		.input(
			z.object({
				queue: z.enum(["ingest", "enrich", "housekeeper", "ai_repair"]),
				status: z.enum(["waiting", "failed", "active", "delayed"]),
				start: z.coerce.number().int().min(0).default(0),
				end: z.coerce.number().int().min(0).default(99),
			}),
		)
		.output(z.object({ jobs: z.array(jobSchema) }))
		.handler(async ({ input }) => {
			const { queue: queueName, status, start } = input;
			const maxEnd = status === "failed" ? 499 : 99;
			const end = Math.min(input.end, maxEnd);

			const queue = QUEUE_MAP[queueName];
			const raw = await queue.getJobs([status], start, end);

			const jobs = raw.map((job) => ({
				id: String(job.id ?? ""),
				name: job.name,
				data: job.data,
				failedReason: job.failedReason ?? null,
				stacktrace: job.stacktrace?.length ? job.stacktrace : null,
				timestamp: job.timestamp,
				processedOn: job.processedOn ?? null,
				finishedOn: job.finishedOn ?? null,
				attemptsMade: job.attemptsMade,
			}));

			return { jobs };
		}),

	triggerExportSqlite: adminProcedure
		.route({
			method: "POST",
			path: "/queues/export-sqlite",
			summary: "Enqueue a full SQLite export of the torrents table",
			tags: ["queues"],
		})
		.output(z.object({ jobId: z.string() }))
		.handler(async () => {
			const [activeJobs, waitingJobs] = await Promise.all([
				housekeeperQueue.getActive(),
				housekeeperQueue.getWaiting(),
			]);

			const isAlreadyRunning = [...activeJobs, ...waitingJobs].some(
				(j) => j.name === HOUSEKEEPER_JOBS.EXPORT_SQLITE,
			);

			if (isAlreadyRunning) {
				throw new ORPCError("CONFLICT", {
					message:
						"An SQLite export is already active or waiting. Wait for it to finish before triggering another.",
				});
			}

			const job = await housekeeperQueue.add(
				HOUSEKEEPER_JOBS.EXPORT_SQLITE,
				{},
				{
					removeOnComplete: { count: 5 },
					removeOnFail: false,
					attempts: 1,
				},
			);

			return { jobId: String(job.id) };
		}),

	listExports: adminProcedure
		.route({
			method: "GET",
			path: "/queues/exports",
			summary: "List available SQLite export files",
			tags: ["queues"],
		})
		.output(
			z.object({
				exports: z.array(
					z.object({
						filename: z.string(),
						sizeBytes: z.number(),
						createdAt: z.string(),
					}),
				),
			}),
		)
		.handler(async () => {
			let files: string[];
			try {
				files = await readdir(exportsDir);
			} catch {
				return { exports: [] };
			}

			const entries = await Promise.all(
				files
					.filter((f) => f.endsWith(".sqlite"))
					.map(async (filename) => {
						const info = await stat(path.join(exportsDir, filename));
						return {
							filename,
							sizeBytes: info.size,
							createdAt: info.birthtime.toISOString(),
						};
					}),
			);

			entries.sort(
				(a, b) =>
					new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
			);

			return { exports: entries };
		}),
};
