import { z } from "zod";

const redisUrlRegex =
	/^rediss?:\/\/([^:]+:[^@]+@)?([^:/]+)(:(\d+))?(\/(\d+))?$/;

export const sharedSchema = {
	NODE_ENV: z
		.enum(["development", "production", "test"])
		.default("development"),
	REDIS_URL: z
		.string()
		.regex(redisUrlRegex, "Invalid Redis connection string format")
		.default("redis://redis:6379"),
	DATABASE_URL: z.string().url(),
	MEILISEARCH_HOST: z.string().min(1).default("http://meilisearch:7700"),
	MEILISEARCH_MASTER_KEY: z.string().min(1),
};

export const tmdbAccessTokenSchema = {
	TMDB_READ_ACCESS_TOKEN: z
		.string()
		.min(1, "TMDB_READ_ACCESS_TOKEN is required")
		.regex(
			/^eyJhbGciOiJIUzI1NiJ9\.[a-zA-Z0-9-_]+\.[a-zA-Z0-9-_]+$/,
			"Invalid TMDB Read Access Token",
		),
};
