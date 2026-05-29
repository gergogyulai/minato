import {
	enrichQueue,
	housekeeperQueue,
	ingestQueue,
} from "@project-minato/queue";
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
};
