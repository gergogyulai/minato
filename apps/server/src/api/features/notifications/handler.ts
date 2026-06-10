import { ORPCError } from "@orpc/server";
import {
	db,
	eq,
	notificationChannels,
	type NotificationChannelConfig,
	type NotificationEvent,
} from "@project-minato/db";
import { NOTIFICATION_JOBS, notificationsQueue } from "@project-minato/queue";
import {
	notificationsCreateContract,
	notificationsDeleteContract,
	notificationsListContract,
	notificationsTestContract,
	notificationsUpdateContract,
} from "@/api/features/notifications/contracts";

function ownedChannel(id: string, userId: string) {
	return db
		.select()
		.from(notificationChannels)
		.where(eq(notificationChannels.id, id))
		.limit(1)
		.then(([row]) => {
			if (!row) throw new ORPCError("NOT_FOUND", { message: "Channel not found" });
			if (row.userId !== userId)
				throw new ORPCError("FORBIDDEN", { message: "Not your channel" });
			return row;
		});
}

export const notificationsRouter = {
	list: notificationsListContract.handler(async ({ context }) => {
		const userId = context.session.user.id;
		const channels = await db
			.select()
			.from(notificationChannels)
			.where(eq(notificationChannels.userId, userId));
		return { channels };
	}),

	create: notificationsCreateContract.handler(async ({ input, context }) => {
		const userId = context.session.user.id;
		const [channel] = await db
			.insert(notificationChannels)
			.values({
				userId,
				name: input.name,
				type: input.type,
				config: input.config as NotificationChannelConfig,
				events: input.events as NotificationEvent[],
			})
			.returning();
		if (!channel) throw new ORPCError("INTERNAL_SERVER_ERROR");
		return channel;
	}),

	update: notificationsUpdateContract.handler(async ({ input, context }) => {
		const userId = context.session.user.id;
		await ownedChannel(input.id, userId);

		const set: Partial<typeof notificationChannels.$inferInsert> = {
			updatedAt: new Date(),
		};
		if (input.name !== undefined) set.name = input.name;
		if (input.config !== undefined)
			set.config = input.config as NotificationChannelConfig;
		if (input.events !== undefined)
			set.events = input.events as NotificationEvent[];
		if (input.enabled !== undefined) set.enabled = input.enabled;

		const [updated] = await db
			.update(notificationChannels)
			.set(set)
			.where(eq(notificationChannels.id, input.id))
			.returning();
		if (!updated) throw new ORPCError("INTERNAL_SERVER_ERROR");
		return updated;
	}),

	delete: notificationsDeleteContract.handler(async ({ input, context }) => {
		const userId = context.session.user.id;
		await ownedChannel(input.id, userId);
		await db
			.delete(notificationChannels)
			.where(eq(notificationChannels.id, input.id));
		return { success: true };
	}),

	test: notificationsTestContract.handler(async ({ input, context }) => {
		const userId = context.session.user.id;
		await ownedChannel(input.id, userId);
		await notificationsQueue.add(NOTIFICATION_JOBS.DISPATCH, {
			event: "wanted_torrent_found",
			payload: {
				title: "The Dark Knight (2008)",
				infoHash: "a1b2c3d4e5f67890a1b2c3d4e5f67890a1b2c3d4",
				scraperName: "1337x",
				type: "Movie",
				resolution: "2160p",
				size: "58.3 GB",
				seeders: 1247,
				group: "FraMeSToR",
				posterUrl: "https://image.tmdb.org/t/p/w300/qJ2tW6WMUDux911r6m7haRef0WH.jpg",
			},
			channelId: input.id,
		});
		return { success: true };
	}),
};
