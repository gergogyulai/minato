import "dotenv/config";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().min(1),
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z.url(),
    CORS_ORIGIN: z.url(),
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

    // App config overrides — all optional, take precedence over DB values
    // See packages/config/src/env-overrides.ts for full documentation.
    MINATO_FLARESOLVERR_URL: z.string().optional(),
    MINATO_ENABLED_SCRAPERS: z.string().optional(),
    MINATO_SCRAPER_PROXY_STRATEGY: z.enum(["round_robin", "sticky"]).optional(),
    MINATO_SCRAPER_PROXY_LIST: z.string().optional(),
    MINATO_WORKERS_INGEST_CONCURRENCY: z.string().optional(),
    MINATO_WORKERS_ENRICHMENT_CONCURRENCY: z.string().optional(),
    MINATO_FEATURES_TORZNAB: z.string().optional(),
    MINATO_FEATURES_RSS: z.string().optional(),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
