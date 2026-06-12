import type Redis from "ioredis";
import { logger } from "@project-minato/utils/logger";
import type { MetadataResult } from "@/lib/metadata/resolver";

const log = logger.child({ module: "MetadataCache" });

const CACHE_PREFIX = "metadata:v1";
const CACHE_TTL_SECONDS = 60 * 60;

function cacheKey(title: string, type: string, year: number | null): string {
	const normalized = title.toLowerCase().trim().replace(/\s+/g, " ");
	return `${CACHE_PREFIX}:${type}:${year ?? "unknown"}:${normalized}`;
}

export class MetadataCache {
	constructor(private redis: Redis) {}

	async get(
		title: string,
		type: string,
		year: number | null,
	): Promise<MetadataResult | null> {
		const key = cacheKey(title, type, year);
		const value = await this.redis.get(key);
		if (!value) return null;
		try {
			return JSON.parse(value) as MetadataResult;
		} catch (err) {
			log.warn({ err, key }, "Failed to parse cached metadata, treating as miss");
			return null;
		}
	}

	async set(
		title: string,
		type: string,
		year: number | null,
		result: MetadataResult,
	): Promise<void> {
		const key = cacheKey(title, type, year);
		await this.redis.set(key, JSON.stringify(result), "EX", CACHE_TTL_SECONDS);
	}
}
