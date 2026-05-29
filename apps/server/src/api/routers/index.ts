import type { RouterClient } from "@orpc/server";
import { protectedProcedure } from "@/api";
import { adminRouter } from "@/api/routers/admin.config.update";
import { apiKeysRouter } from "@/api/routers/api-keys";
import { blacklistRouter } from "@/api/routers/blacklist";
import { queuesRouter } from "@/api/routers/queues";
import { scraperRouter } from "@/api/routers/scraper";
import { searchRouter } from "@/api/routers/search";
import { setupRouter } from "@/api/routers/setup";
import { statsRouter } from "@/api/routers/stats";
import { torrentRouter } from "@/api/routers/torrents";
import { usersRouter } from "@/api/routers/users";

export const appRouter = {
	privateData: protectedProcedure.handler(({ context }) => {
		return {
			message: "This is private",
			user: context.session?.user,
		};
	}),
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
};
export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<typeof appRouter>;
