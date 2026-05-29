import { protectedProcedure } from "@/api";
import { torrentRouter } from "@/api/routers/torrents";
import { blacklistRouter } from "@/api/routers/blacklist";
import { searchRouter } from "@/api/routers/search";
import { setupRouter } from "@/api/routers/setup";
import { adminRouter } from "@/api/routers/admin.config.update";
import { scraperRouter } from "@/api/routers/scraper";
import { apiKeysRouter } from "@/api/routers/api-keys";

import type { RouterClient } from "@orpc/server";

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
};
export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<typeof appRouter>;
