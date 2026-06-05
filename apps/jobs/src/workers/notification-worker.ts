import {
	and,
	db,
	eq,
	notificationChannels,
	sql,
} from "@project-minato/db";
import {
	connection,
	NOTIFICATION_JOBS,
	QUEUES,
	type NotificationDispatchJobData,
} from "@project-minato/queue";
import { type Job, Worker } from "bullmq";

import { deliverToChannel } from "@/lib/notifications";
import { logger } from "@/utils/logger";

const log = logger.child({ worker: "notifications" });

async function handleDispatch(job: Job<NotificationDispatchJobData>): Promise<void> {
	const { event, payload, channelId } = job.data;

	const channels = channelId
		? await db
				.select()
				.from(notificationChannels)
				.where(
					and(
						eq(notificationChannels.id, channelId),
						eq(notificationChannels.enabled, true),
					),
				)
		: await db
				.select()
				.from(notificationChannels)
				.where(
					and(
						eq(notificationChannels.enabled, true),
						sql`${event} = ANY(${notificationChannels.events})`,
					),
				);

	if (channels.length === 0) return;

	const results = await Promise.allSettled(
		channels.map((ch) => deliverToChannel(ch, event, payload)),
	);

	const failures = results.filter((r) => r.status === "rejected");
	if (failures.length > 0) {
		for (const f of failures) {
			if (f.status === "rejected") {
				log.warn({ reason: f.reason }, "Channel delivery failed");
			}
		}
		if (failures.length === channels.length) {
			throw new Error(`All ${channels.length} channel(s) failed to deliver`);
		}
	}
}

export function startNotificationWorker() {
	return new Worker(
		QUEUES.NOTIFICATIONS,
		async (job: Job) => {
			switch (job.name) {
				case NOTIFICATION_JOBS.DISPATCH:
					return await handleDispatch(job as Job<NotificationDispatchJobData>);
				default:
					log.warn({ jobName: job.name }, "Unknown notification job");
					throw new Error(`Unknown job name: ${job.name}`);
			}
		},
		{ connection, concurrency: 10 },
	);
}
