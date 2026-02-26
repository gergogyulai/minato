import { z } from "zod";

export const sharedSchema = {
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  DATABASE_URL: z.string().url(),
  MEILISEARCH_HOST: z.string().min(1),
  MEILISEARCH_MASTER_KEY: z.string().min(1),
  MEDIA_ROOT: z.string().min(1),
};

export const tmdbAccessTokenSchema = z
  .string()
  .regex(
    /^eyJhbGciOiJIUzI1NiJ9\.[a-zA-Z0-9-_]+\.[a-zA-Z0-9-_]+$/,
    "Invalid TMDB Read Access Token",
  );
