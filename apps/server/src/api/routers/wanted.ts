import { ORPCError } from "@orpc/server";
import {
	db,
	eq,
	sql,
	torrents,
	wantedItems,
	wantedMatches,
} from "@project-minato/db";
import type { NewWantedItem, WantedItem } from "@project-minato/db";
import { env } from "@project-minato/env/server";
import {
	wantedCreateContract,
	wantedDeleteContract,
	wantedListContract,
	wantedMatchesContract,
	wantedTmdbSearchContract,
	wantedUpdateContract,
} from "@/api/contracts/wanted.contracts";

const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_IMG = "https://image.tmdb.org/t/p/w92";

async function tmdbFetch(path: string) {
	const res = await fetch(`${TMDB_BASE}${path}`, {
		headers: { Authorization: `Bearer ${env.TMDB_READ_ACCESS_TOKEN}` },
	});
	if (!res.ok) throw new Error(`TMDB ${res.status}`);
	return res.json() as Promise<Record<string, unknown>>;
}

function normalizeItem(item: WantedItem) {
	return {
		...item,
		group: item.group ?? null,
		requiredFlags: item.requiredFlags ?? [],
		excludedFlags: item.excludedFlags ?? [],
	};
}

async function withMatchCount(item: WantedItem) {
	const [row] = await db
		.select({ value: sql<number>`cast(count(*) as integer)` })
		.from(wantedMatches)
		.where(eq(wantedMatches.wantedItemId, item.id));
	return { ...normalizeItem(item), matchCount: row?.value ?? 0 };
}

async function ownedItem(id: string, userId: string) {
	const [row] = await db.select().from(wantedItems).where(eq(wantedItems.id, id)).limit(1);
	if (!row) throw new ORPCError("NOT_FOUND", { message: "Watchlist entry not found" });
	if (row.userId !== userId) throw new ORPCError("FORBIDDEN", { message: "Not your entry" });
	return row;
}

export const wantedRouter = {
	tmdbSearch: wantedTmdbSearchContract.handler(async ({ input }) => {
		const q = encodeURIComponent(input.q);
		const { type } = input;

		if (type === "movie") {
			const data = await tmdbFetch(`/search/movie?query=${q}&include_adult=false&language=en-US&page=1`) as {
				results: Array<{ id: number; title: string; release_date?: string; poster_path?: string | null }>;
			};
			return {
				results: data.results.slice(0, 8).map((r) => ({
					tmdbId: r.id,
					title: r.title,
					year: r.release_date ? new Date(r.release_date).getFullYear() : null,
					posterUrl: r.poster_path ? `${TMDB_IMG}${r.poster_path}` : null,
					mediaType: "movie" as const,
				})),
			};
		}

		if (type === "tv") {
			const data = await tmdbFetch(`/search/tv?query=${q}&include_adult=false&language=en-US&page=1`) as {
				results: Array<{ id: number; name: string; first_air_date?: string; poster_path?: string | null }>;
			};
			return {
				results: data.results.slice(0, 8).map((r) => ({
					tmdbId: r.id,
					title: r.name,
					year: r.first_air_date ? new Date(r.first_air_date).getFullYear() : null,
					posterUrl: r.poster_path ? `${TMDB_IMG}${r.poster_path}` : null,
					mediaType: "tv" as const,
				})),
			};
		}

		// Multi search for "any" / unspecified type
		const data = await tmdbFetch(`/search/multi?query=${q}&include_adult=false&language=en-US&page=1`) as {
			results: Array<{
				id: number;
				media_type: string;
				title?: string;
				name?: string;
				release_date?: string;
				first_air_date?: string;
				poster_path?: string | null;
			}>;
		};
		return {
			results: data.results
				.filter((r) => r.media_type === "movie" || r.media_type === "tv")
				.slice(0, 8)
				.map((r) => ({
					tmdbId: r.id,
					title: (r.title ?? r.name ?? ""),
					year: (r.release_date ?? r.first_air_date)
						? new Date((r.release_date ?? r.first_air_date)!).getFullYear()
						: null,
					posterUrl: r.poster_path ? `${TMDB_IMG}${r.poster_path}` : null,
					mediaType: (r.media_type === "movie" ? "movie" : "tv") as "movie" | "tv",
				})),
		};
	}),

	list: wantedListContract.handler(async ({ context }) => {
		const userId = context.session.user.id;
		const rows = await db.select().from(wantedItems).where(eq(wantedItems.userId, userId));
		const items = await Promise.all(rows.map(withMatchCount));
		return { items };
	}),

	create: wantedCreateContract.handler(async ({ input, context }) => {
		const userId = context.session.user.id;
		const values: NewWantedItem = {
			userId,
			name: input.name,
			oneShot: input.oneShot,
			mediaType: input.mediaType ?? undefined,
			tmdbId: input.tmdbId ?? undefined,
			title: input.title ?? undefined,
			year: input.year ?? undefined,
			season: input.season ?? undefined,
			episode: input.episode ?? undefined,
			seasonPack: input.seasonPack ?? undefined,
			resolution: input.resolution ?? undefined,
			group: input.group ?? undefined,
			requiredFlags: input.requiredFlags,
			excludedFlags: input.excludedFlags,
		};
		const [row] = await db.insert(wantedItems).values(values).returning();
		if (!row) throw new ORPCError("INTERNAL_SERVER_ERROR");
		return withMatchCount(row);
	}),

	update: wantedUpdateContract.handler(async ({ input, context }) => {
		const userId = context.session.user.id;
		await ownedItem(input.id, userId);

		const set: Partial<typeof wantedItems.$inferInsert> = { updatedAt: new Date() };
		if (input.name !== undefined) set.name = input.name;
		if (input.enabled !== undefined) set.enabled = input.enabled;
		if (input.oneShot !== undefined) set.oneShot = input.oneShot;
		if (input.mediaType !== undefined) set.mediaType = input.mediaType ?? undefined;
		if (input.tmdbId !== undefined) set.tmdbId = input.tmdbId ?? undefined;
		if (input.title !== undefined) set.title = input.title ?? undefined;
		if (input.year !== undefined) set.year = input.year ?? undefined;
		if (input.season !== undefined) set.season = input.season ?? undefined;
		if (input.episode !== undefined) set.episode = input.episode ?? undefined;
		if (input.seasonPack !== undefined) set.seasonPack = input.seasonPack ?? undefined;
		if (input.resolution !== undefined) set.resolution = input.resolution ?? undefined;
		if (input.group !== undefined) set.group = input.group ?? undefined;
		if (input.requiredFlags !== undefined) set.requiredFlags = input.requiredFlags;
		if (input.excludedFlags !== undefined) set.excludedFlags = input.excludedFlags;

		const [updated] = await db
			.update(wantedItems)
			.set(set)
			.where(eq(wantedItems.id, input.id))
			.returning();
		if (!updated) throw new ORPCError("INTERNAL_SERVER_ERROR");
		return withMatchCount(updated);
	}),

	delete: wantedDeleteContract.handler(async ({ input, context }) => {
		const userId = context.session.user.id;
		await ownedItem(input.id, userId);
		await db.delete(wantedItems).where(eq(wantedItems.id, input.id));
		return { success: true };
	}),

	matches: wantedMatchesContract.handler(async ({ input, context }) => {
		const userId = context.session.user.id;
		await ownedItem(input.id, userId);

		const rows = await db
			.select({
				id: wantedMatches.id,
				wantedItemId: wantedMatches.wantedItemId,
				torrentInfoHash: wantedMatches.torrentInfoHash,
				matchedAt: wantedMatches.matchedAt,
				torrentTitle: torrents.trackerTitle,
				resolution: sql<string | null>`${torrents.releaseData}->>'resolution'`,
				seeders: torrents.seeders,
				size: torrents.size,
			})
			.from(wantedMatches)
			.leftJoin(torrents, eq(wantedMatches.torrentInfoHash, torrents.infoHash))
			.where(eq(wantedMatches.wantedItemId, input.id))
			.orderBy(sql`${wantedMatches.matchedAt} desc`)
			.limit(100);

		return {
			matches: rows.map((r) => ({
				...r,
				torrentTitle: r.torrentTitle ?? null,
				size: r.size ?? 0,
			})),
		};
	}),
};
