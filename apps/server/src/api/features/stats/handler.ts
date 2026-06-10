import {
	blacklistedTorrents,
	blacklistedTrackers,
	db,
	eq,
	isNotNull,
	scrapers,
	sql,
	torrents,
	user,
} from "@project-minato/db";
import { z } from "zod";
import { adminProcedure } from "@/api";

const countAll = sql<number>`cast(count(*) as int)`;

export const statsRouter = {
	overview: adminProcedure
		.route({
			method: "GET",
			path: "/stats/overview",
			summary: "Aggregate counts for the admin dashboard",
			tags: ["stats"],
		})
		.output(
			z.object({
				torrents: z.object({
					total: z.number(),
					enriched: z.number(),
					pending: z.number(),
				}),
				byType: z.array(z.object({ type: z.string(), count: z.number() })),
				users: z.object({ total: z.number(), admins: z.number() }),
				scrapers: z.object({
					total: z.number(),
					enabled: z.number(),
					running: z.number(),
				}),
				blacklist: z.object({ torrents: z.number(), trackers: z.number() }),
			}),
		)
		.handler(async () => {
			const [
				torrentTotal,
				enriched,
				pending,
				byTypeRows,
				userTotal,
				adminTotal,
				scraperTotal,
				scraperEnabled,
				scraperRunning,
				blTorrents,
				blTrackers,
			] = await Promise.all([
				db.select({ c: countAll }).from(torrents),
				db
					.select({ c: countAll })
					.from(torrents)
					.where(isNotNull(torrents.enrichedAt)),
				db
					.select({ c: countAll })
					.from(torrents)
					.where(eq(torrents.isDirty, true)),
				db
					.select({ type: torrents.type, c: countAll })
					.from(torrents)
					.groupBy(torrents.type),
				db.select({ c: countAll }).from(user),
				db.select({ c: countAll }).from(user).where(eq(user.role, "admin")),
				db.select({ c: countAll }).from(scrapers),
				db
					.select({ c: countAll })
					.from(scrapers)
					.where(eq(scrapers.enabled, true)),
				db
					.select({ c: countAll })
					.from(scrapers)
					.where(eq(scrapers.state, "running")),
				db.select({ c: countAll }).from(blacklistedTorrents),
				db.select({ c: countAll }).from(blacklistedTrackers),
			]);

			return {
				torrents: {
					total: torrentTotal[0]?.c ?? 0,
					enriched: enriched[0]?.c ?? 0,
					pending: pending[0]?.c ?? 0,
				},
				byType: byTypeRows.map((r) => ({
					type: r.type ?? "unknown",
					count: r.c,
				})),
				users: { total: userTotal[0]?.c ?? 0, admins: adminTotal[0]?.c ?? 0 },
				scrapers: {
					total: scraperTotal[0]?.c ?? 0,
					enabled: scraperEnabled[0]?.c ?? 0,
					running: scraperRunning[0]?.c ?? 0,
				},
				blacklist: {
					torrents: blTorrents[0]?.c ?? 0,
					trackers: blTrackers[0]?.c ?? 0,
				},
			};
		}),

	ingestActivity: adminProcedure
		.route({
			method: "GET",
			path: "/stats/ingest-activity",
			summary: "Torrents ingested per hour over a recent window",
			tags: ["stats"],
		})
		.input(
			z
				.object({ hours: z.number().int().min(1).max(72).default(24) })
				.optional(),
		)
		.output(
			z.object({
				points: z.array(z.object({ date: z.string(), count: z.number() })),
			}),
		)
		.handler(async ({ input }) => {
			const hours = input?.hours ?? 24;

			const result = await db.execute<{ date: string; count: number }>(sql`
        SELECT to_char(d.hour, 'YYYY-MM-DD HH24:00') AS date,
               count(t.info_hash)::int AS count
        FROM generate_series(
          date_trunc('hour', now()) - make_interval(hours => ${hours - 1}),
          date_trunc('hour', now()),
          interval '1 hour'
        ) AS d(hour)
        LEFT JOIN torrents t
          ON date_trunc('hour', t.created_at) = d.hour
        GROUP BY d.hour
        ORDER BY d.hour
      `);

			const rows = (result as unknown as { rows?: unknown[] }).rows ?? result;
			const points = (rows as { date: string; count: number }[]).map((r) => ({
				date: r.date,
				count: Number(r.count),
			}));

			return { points };
		}),
};
