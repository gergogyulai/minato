import { setDeep } from "./utils"
import { RANKING_PROFILES_OPTIONS } from "@project-minato/meilisearch"
import { createEnv } from "@t3-oss/env-core"
import { z } from "zod"

const overridesEnv = createEnv({
  server: {
    MINATO_FLARESOLVERR_URL:               z.string().url().optional(),
    MINATO_ENABLED_SCRAPERS:               z
      .string()
      .transform((s) => s.split(",").map((v) => v.trim()).filter(Boolean))
      .optional(),
    MINATO_WORKERS_INGEST_CONCURRENCY:     z.coerce.number().int().min(1).max(50).optional(),
    MINATO_WORKERS_ENRICHMENT_CONCURRENCY: z.coerce.number().int().min(1).max(20).optional(),
    MINATO_SEARCH_ENGINE_PROFILE:          z.enum(RANKING_PROFILES_OPTIONS).optional(),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
})

const CONFIG_PATH_MAP = {
  MINATO_FLARESOLVERR_URL:               "scraper.flareSolverrUrl",
  MINATO_ENABLED_SCRAPERS:               "scraper.enabledScrapers",
  MINATO_WORKERS_INGEST_CONCURRENCY:     "workers.ingest.concurrency",
  MINATO_WORKERS_ENRICHMENT_CONCURRENCY: "workers.enrichment.concurrency",
  MINATO_SEARCH_ENGINE_PROFILE:          "search.profile",
} satisfies Record<keyof typeof overridesEnv, string>

export function readEnvOverrides(): Record<string, unknown> {
  let overrides: Record<string, unknown> = {}

  for (const [key, path] of Object.entries(CONFIG_PATH_MAP)) {
    const value = overridesEnv[key as keyof typeof overridesEnv]
    if (value !== undefined) overrides = setDeep(overrides, path, value)
  }

  return overrides
}