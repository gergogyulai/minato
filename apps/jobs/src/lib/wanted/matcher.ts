import {
	and,
	db,
	eq,
	isNull,
	or,
	sql,
	wantedItems,
	wantedMatches,
} from "@project-minato/db";
import type { Enrichment, Torrent, WantedItem } from "@project-minato/db";
import { NOTIFICATION_JOBS, notificationsQueue } from "@project-minato/queue";

import { logger } from "@/utils/logger";

const log = logger.child({ lib: "wanted-matcher" });

function normalize(s: string | null | undefined): string {
	return (s ?? "").toLowerCase().trim();
}

function matchesCriteria(item: WantedItem, torrent: Torrent, enrichment: Enrichment): boolean {
	const flags: string[] = (torrent.releaseData as any)?.flags ?? [];
	const seriesDetails = enrichment.seriesDetails;

	// Content: prefer tmdbId exact match, fall back to normalized title
	if (item.tmdbId != null) {
		if (enrichment.tmdbId !== item.tmdbId) return false;
	} else if (item.title != null) {
		if (normalize(enrichment.title) !== normalize(item.title)) return false;
	}

	if (item.year != null && enrichment.year !== item.year) return false;
	if (item.season != null && seriesDetails?.seasonNumber != item.season) return false;
	if (item.episode != null && seriesDetails?.episodeNumber != item.episode) return false;
	if (item.seasonPack != null && seriesDetails?.isSeasonPack !== item.seasonPack) return false;

	// Quality
	if (item.resolution != null && (torrent.releaseData as any)?.resolution !== item.resolution) return false;
	if (item.group != null && (torrent.releaseData as any)?.group?.toLowerCase() !== item.group.toLowerCase()) return false;
	if (item.requiredFlags && item.requiredFlags.length > 0) {
		if (!item.requiredFlags.every((f) => flags.includes(f))) return false;
	}
	if (item.excludedFlags && item.excludedFlags.length > 0) {
		if (item.excludedFlags.some((f) => flags.includes(f))) return false;
	}

	return true;
}

export async function checkWantedItems(torrent: Torrent, enrichment: Enrichment): Promise<void> {
	const mediaType = enrichment.mediaType as string | null;

	const candidates = await db
		.select()
		.from(wantedItems)
		.where(
			and(
				eq(wantedItems.enabled, true),
				or(eq(wantedItems.oneShot, false), isNull(wantedItems.lastMatchAt)),
				mediaType
					? or(isNull(wantedItems.mediaType), sql`${wantedItems.mediaType} = ${mediaType}`)
					: undefined,
			),
		);

	if (candidates.length === 0) return;

	for (const item of candidates) {
		if (!matchesCriteria(item, torrent, enrichment)) continue;

		// Insert match — skip silently if already recorded
		const [inserted] = await db
			.insert(wantedMatches)
			.values({ wantedItemId: item.id, torrentInfoHash: torrent.infoHash })
			.onConflictDoNothing()
			.returning({ id: wantedMatches.id });

		if (!inserted) continue; // duplicate — already notified

		log.info({ wantedItemId: item.id, infoHash: torrent.infoHash }, "Wanted item matched");

		await notificationsQueue.add(NOTIFICATION_JOBS.DISPATCH, {
			event: "wanted_torrent_found",
			userId: item.userId,
			payload: {
				title: enrichment.title ?? torrent.trackerTitle,
				infoHash: torrent.infoHash,
				wantedItemName: item.name,
				scraperName: (torrent.sources as any[])[0]?.name ?? null,
				type: enrichment.mediaType,
				resolution: (torrent.releaseData as any)?.resolution ?? null,
				size: torrent.size,
				seeders: torrent.seeders,
				group: (torrent.releaseData as any)?.group ?? null,
				posterUrl: enrichment.posterUrl ?? null,
			},
		});

		if (item.oneShot) {
			await db
				.update(wantedItems)
				.set({ lastMatchAt: new Date() })
				.where(eq(wantedItems.id, item.id));
		}
	}
}
