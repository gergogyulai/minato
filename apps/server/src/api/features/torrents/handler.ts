import { ORPCError } from "@orpc/server";
import {
	db,
	eq,
	inArray,
	sql,
	torrents,
} from "@project-minato/db";
import { meiliClient } from "@project-minato/meilisearch";
import { requireAdmin, requireScraperKey } from "@/api";
import {
	deleteContract,
	getContract,
	getCountContract,
	ingestContract,
	updateContract,
} from "@/api/features/torrents/contracts";
import { processTorrents } from "@/lib/ingest/process-torrents";

export const torrentRouter = {
	ingest: ingestContract
		.use(requireScraperKey)
		.handler(async ({ input, context }) => {
			const { scraperId } = context;

			console.log(
				`[ingest] ${input.length} items from scraper ${scraperId}, first:`,
				JSON.stringify(input[0], null, 2),
			);

			try {
				return await processTorrents(input, scraperId);
			} catch (error) {
				console.error("Ingestion Error:", error);
				throw new ORPCError("INTERNAL_SERVER_ERROR", {
					message: "Internal Server Error",
				});
			}
		}),
	get: getContract.handler(async ({ input }) => {
		const { infoHash } = input;

		const torrent = await db.query.torrents.findFirst({
			where: (torrents: any) => eq(torrents.infoHash, infoHash),
			with: {
				enrichment: true,
			},
		});

		if (!torrent) {
			throw new ORPCError("NOT_FOUND", {
				message: `Torrent with info hash ${infoHash} not found`,
			});
		}

		return torrent as any;
	}),

	getCount: getCountContract.handler(async () => {
		const result = await db
			.select({ count: sql<number>`cast(count(*) as integer)` })
			.from(torrents);

		return {
			count: result[0]?.count ?? 0,
		};
	}),

	update: updateContract.use(requireAdmin).handler(async ({ input }) => {
		const { infoHash, ...updateFields } = input;

		// Check if torrent exists
		const existing = await db
			.select({ infoHash: torrents.infoHash })
			.from(torrents)
			.where(eq(torrents.infoHash, infoHash.toLowerCase()))
			.limit(1);

		if (existing.length === 0) {
			throw new ORPCError("NOT_FOUND", {
				message: `Torrent with infoHash ${infoHash} not found`,
			});
		}

		// Build update object with only provided fields
		const updateData: Record<string, any> = {};

		if (updateFields.trackerTitle !== undefined)
			updateData.trackerTitle = updateFields.trackerTitle;
		if (updateFields.seeders !== undefined)
			updateData.seeders = updateFields.seeders;
		if (updateFields.leechers !== undefined)
			updateData.leechers = updateFields.leechers;
		if (updateFields.trackerCategory !== undefined)
			updateData.trackerCategory = updateFields.trackerCategory;
		if (updateFields.standardCategory !== undefined)
			updateData.standardCategory = updateFields.standardCategory;
		if (updateFields.files !== undefined) updateData.files = updateFields.files;
		if (updateFields.magnet !== undefined)
			updateData.magnet = updateFields.magnet;
		if (updateFields.type !== undefined) updateData.type = updateFields.type;

		if (Object.keys(updateData).length === 0) {
			throw new ORPCError("BAD_REQUEST", {
				message: "No fields provided to update",
			});
		}

		await db
			.update(torrents)
			.set(updateData)
			.where(eq(torrents.infoHash, infoHash.toLowerCase()));

		return {
			success: true,
			updatedFields: Object.keys(updateData),
			message: `Torrent ${infoHash} updated successfully with ${Object.keys(updateData).length} field(s)`,
		};
	}),

	delete: deleteContract.use(requireAdmin).handler(async ({ input }) => {
		const { infoHashes } = input;
		const normalizedHashes = infoHashes.map((h) => h.toLowerCase());

		const deleted = await db
			.delete(torrents)
			.where(inArray(torrents.infoHash, normalizedHashes))
			.returning({ infoHash: torrents.infoHash });

		await meiliClient
			.index("torrents")
			.deleteDocuments(deleted.map((t) => t.infoHash));

		return {
			success: true,
			count: deleted.length,
			message: `Successfully deleted ${deleted.length} torrent(s)`,
			deletedHashes: deleted.map((t) => t.infoHash),
		};
	}),
};
