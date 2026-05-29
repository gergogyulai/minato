import { ORPCError, os } from "@orpc/server";

import type { Context } from "@/api/context";

export const o = os.$context<Context>();

export const publicProcedure = o;

export const requireAuth = o.middleware(async ({ context, next }) => {
	if (!context.session?.user) {
		throw new ORPCError("UNAUTHORIZED");
	}
	return next({
		context: {
			session: context.session,
		},
	});
});

export const requireAdmin = o.middleware(async ({ context, next }) => {
	if (!context.session?.user) {
		throw new ORPCError("UNAUTHORIZED");
	}
	if ((context.session.user as { role?: string }).role !== "admin") {
		throw new ORPCError("FORBIDDEN");
	}
	return next({
		context: {
			session: context.session,
		},
	});
});

export const requireScraperKey = o.middleware(async ({ context, next }) => {
	const scraperId = (context.apiKey?.metadata as { scraperId?: string } | null)
		?.scraperId;
	if (!context.apiKey || !scraperId) {
		throw new ORPCError("UNAUTHORIZED", {
			message: "Valid scraper API key required",
		});
	}
	return next({
		context: { scraperId },
	});
});

export const protectedProcedure = publicProcedure.use(requireAuth);
export const adminProcedure = publicProcedure.use(requireAdmin);
export const scraperProcedure = publicProcedure.use(requireScraperKey);
