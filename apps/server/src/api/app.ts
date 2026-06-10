import type { RouterClient } from "@orpc/server";
import { adminRouter } from "@/api/features/admin/handler";
import { apiKeysRouter } from "@/api/features/api-keys/handler";
import { blacklistRouter } from "@/api/features/blacklist/handler";
import { notificationsRouter } from "@/api/features/notifications/handler";
import { queuesRouter } from "@/api/features/queues/handler";
import { scraperRouter } from "@/api/features/scraper/handler";
import { searchRouter } from "@/api/features/search/handler";
import { setupRouter } from "@/api/features/setup/handler";
import { statsRouter } from "@/api/features/stats/handler";
import { torrentRouter } from "@/api/features/torrents/handler";
import { usersRouter } from "@/api/features/users/handler";
import { wantedRouter } from "@/api/features/wanted/handler";

export const appRouter = {
	torrents: torrentRouter,
	blacklist: blacklistRouter,
	search: searchRouter,
	setup: setupRouter,
	admin: adminRouter,
	scraper: scraperRouter,
	apiKeys: apiKeysRouter,
	stats: statsRouter,
	queues: queuesRouter,
	users: usersRouter,
	notifications: notificationsRouter,
	wanted: wantedRouter,
};
export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<typeof appRouter>;
