import type { RouterClient } from "@orpc/server";

import { protectedProcedure } from "../index";

import { torrentRouter } from "./torrents";

export const appRouter = {
  privateData: protectedProcedure.handler(({ context }) => {
    return {
      message: "This is private",
      user: context.session?.user,
    };
  }),
  torrents: torrentRouter,
};
export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<typeof appRouter>;
