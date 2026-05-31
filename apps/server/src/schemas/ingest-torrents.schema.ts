import { z } from "zod";

const FileInfoSchema = z.array(
	z.object({
		filename: z.string(),
		size: z.number().int().nonnegative(),
	}),
);

// Accept both number (the SDK's ergonomic shape — JS numbers are safe up to
// 2^53, well past any torrent's bytes) and string (for callers that need
// the full 64-bit range). Always materialize as a digit string so the
// downstream bigint check and Postgres `bigint` column work uniformly.
const sizeSchema = z
	.union([
		z.number().int().nonnegative(),
		z.string().regex(/^\d+$/, "Size must be digits"),
	])
	.transform((v) => (typeof v === "number" ? String(v) : v))
	.refine((val) => {
		try {
			const b = BigInt(val);
			return b >= 0n && b <= 9223372036854775807n;
		} catch {
			return false;
		}
	}, "Size exceeds 64-bit integer limit");

export const IngestTorrentsSchema = z.object({
	infoHash: z
		.string()
		.length(40)
		.transform((val) => val.toLowerCase()),
	title: z.string(),
	size: sizeSchema,
	seeders: z.number().default(0),
	leechers: z.number().default(0),
	category: z.string().optional().default("uncategorized"),
	magnet: z
		.string()
		.regex(/^magnet:\?xt=urn:[a-z0-9]+:[a-z0-9]{32,40}/i)
		.optional(),
	files: FileInfoSchema.optional(),
	source: z.object({
		name: z.string(),
		// These are display fields only — scrapers may send null or omit them.
		origin: z.string().nullish(),
		originUrl: z.string().nullish(),
		url: z.string().nullish(),
	}),
});

export const IngestTorrentsResponseSchema = z.object({
	count: z.number(),
	message: z.string(),
});

export type IngestTorrentsResponse = z.infer<
	typeof IngestTorrentsResponseSchema
>;
export type IngestInput = z.infer<typeof IngestTorrentsSchema>;
