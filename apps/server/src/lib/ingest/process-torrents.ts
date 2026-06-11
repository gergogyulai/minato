import {
	blacklistedTorrents,
	blacklistedTrackers,
	db,
	sql,
	torrents,
} from "@project-minato/db";
import { INGEST_JOBS, ingestQueue } from "@project-minato/queue";
import type { IngestInput } from "@/api/features/torrents/schemas";

const INGEST_CHUNK_SIZE = 250;

export async function processTorrents(
	inputs: IngestInput[],
	scraperId: string,
) {
	if (inputs.length === 0) {
		return { count: 0, message: "No torrents provided" };
	}

	const uniqueInputs = Array.from(
		inputs
			.reduce(
				(map, item) => map.set(item.infoHash, item),
				new Map<string, IngestInput>(),
			)
			.values(),
	);

	const results = await db.transaction(async (tx) => {
		const rawBlacklistedHashes = await tx
			.select({ hash: blacklistedTorrents.infoHash })
			.from(blacklistedTorrents);

		const rawBlacklistedTrackers = await tx
			.select({ url: blacklistedTrackers.url })
			.from(blacklistedTrackers);

		const blacklistedHashSet = new Set(
			rawBlacklistedHashes.map((entry) => entry.hash),
		);
		const blacklistedTrackerUrls = rawBlacklistedTrackers.flatMap(
			(tracker) => tracker.url,
		);

		const validTorrents = uniqueInputs.filter((torrent) => {
			const isHashBlacklisted = blacklistedHashSet.has(torrent.infoHash);
			if (isHashBlacklisted) return false;

			const torrentSourceUrl = torrent.source.url;
			if (!torrentSourceUrl) return true;

			const containsBlacklistedTracker = blacklistedTrackerUrls.some(
				(keyword) => keyword && torrentSourceUrl.includes(keyword),
			);

			return !containsBlacklistedTracker;
		});

		if (validTorrents.length === 0) return [];

		const values = validTorrents.map((item) => ({
			infoHash: item.infoHash,
			trackerTitle: item.title,
			trackerCategory: item.category,
			size: Number(item.size),
			seeders: item.seeders,
			leechers: item.leechers,
			magnet: item.magnet,
			files: item.files,
			isDirty: true,
			sources: [
				{
					name: item.source.name,
					url: item.source.url ?? null,
					origin: item.source.origin ?? null,
					originUrl: item.source.originUrl ?? null,
					scraper: scraperId,
				},
			],
		}));

		return tx
			.insert(torrents)
			.values(values)
			.onConflictDoUpdate({
				target: torrents.infoHash,
				set: {
					seeders: sql`excluded.seeders`,
					leechers: sql`excluded.leechers`,
					isDirty: true,
					lastSeenAt: sql`now()`,
					sources: sql`
                  (SELECT jsonb_agg(DISTINCT e) 
                   FROM jsonb_array_elements(${torrents.sources} || excluded.sources) AS e)
                `,
				},
			})
			.returning({ infoHash: torrents.infoHash });
	});

	if (results.length === 0) {
		return {
			count: 0,
			message: "No new torrents added (all blacklisted or empty)",
		};
	}

	const chunks: string[][] = [];
	for (let i = 0; i < results.length; i += INGEST_CHUNK_SIZE) {
		chunks.push(results.slice(i, i + INGEST_CHUNK_SIZE).map((t) => t.infoHash));
	}

	await ingestQueue.addBulk(
		chunks.map((infoHashes) => ({
			name: INGEST_JOBS.INDEX,
			data: { infoHashes },
		})),
	);

	return {
		count: results.length,
		message: `Successfully ingested and queued ${results.length} torrents`,
	};
}
