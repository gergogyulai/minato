import type { RouterClient } from "@orpc/server";

import { protectedProcedure } from "../index";

import { torrentRouter } from "./torrents";
import { blacklistRouter } from "./blacklist";
import { searchRouter } from "./search";

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
};
export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<typeof appRouter>;
