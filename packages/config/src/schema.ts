import { RANKING_PROFILES_OPTIONS } from "@project-minato/meilisearch";
import { z } from "zod";

const csvToArray = z.preprocess(
  (val) =>
    typeof val === "string"
      ? val
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean)
      : val,
  z.array(z.string()),
);

export const setupStepSchema = z.enum(["admin", "scrapers", "flaresolverr"]);
export type SetupStep = z.infer<typeof setupStepSchema>;

export const setupProgressSchema = z.object({
  currentStep: setupStepSchema,
  completedSteps: z.array(setupStepSchema),
});

const setupSchema = z.object({
  setupCompleted: z.boolean().default(false),
  setupProgress: setupProgressSchema.default({
    currentStep: "admin",
    completedSteps: [],
  }),
});

const scraperSchema = z.object({
  flareSolverrUrl: z.url().default("http://flaresolverr:8191"),
  proxyUrl: z.string().optional(),
  enabledScrapers: csvToArray.default([
    "1337x",
    "thepiratebay",
    "knaben",
    "eztv",
    "yts",
  ]),
});

const ingestSchema = z.object({
  concurrency: z.coerce.number().int().min(1).max(50).default(5),
});

const enrichmentSchema = z.object({
  concurrency: z.coerce.number().int().min(1).max(20).default(5),
});

export const AI_REPAIR_PROVIDERS = ["openrouter", "ollama"] as const;
export type AIRepairProvider = (typeof AI_REPAIR_PROVIDERS)[number];

const aiRepairSchema = z.object({
  provider: z.enum(AI_REPAIR_PROVIDERS).default("openrouter"),
  model: z.string().min(1).default("deepseek/deepseek-v4-flash"),
  ollamaUrl: z.url().default("http://ollama:11434"),
  reasoning: z.preprocess(
    (val) => (typeof val === "string" ? val === "true" : val),
    z.boolean().default(false),
  ),
});

const workersSchema = z.object({
  ingest: ingestSchema.default(ingestSchema.parse({})),
  enrichment: enrichmentSchema.default(enrichmentSchema.parse({})),
  aiRepair: aiRepairSchema.default(aiRepairSchema.parse({})),
});

const searchSchema = z.object({
  profile: z.enum(RANKING_PROFILES_OPTIONS).default("health"),
});

export const configSchema = z.object({
  setup: setupSchema.default(setupSchema.parse({})),
  scraper: scraperSchema.default(scraperSchema.parse({})),
  search: searchSchema.default(searchSchema.parse({})),
  workers: workersSchema.default(workersSchema.parse({})),
  internalSupervisorSecret: z.string().default(""),
});

export type AppConfig = z.infer<typeof configSchema>;
export type SetupConfig = AppConfig["setup"];
export type SetupProgress = z.infer<typeof setupProgressSchema>;

export function getEnvConfig() {
  return {
    scraper: {
      flareSolverrUrl: process.env.MINATO_FLARESOLVERR_URL,
      proxyUrl: process.env.MINATO_PROXY_URL,
      enabledScrapers: process.env.MINATO_ENABLED_SCRAPERS,
    },
    workers: {
      ingest: { concurrency: process.env.MINATO_WORKERS_INGEST_CONCURRENCY },
      enrichment: {
        concurrency: process.env.MINATO_WORKERS_ENRICHMENT_CONCURRENCY,
      },
      aiRepair: {
        provider: process.env.MINATO_AI_REPAIR_PROVIDER,
        model: process.env.MINATO_AI_REPAIR_MODEL,
        ollamaUrl: process.env.MINATO_AI_REPAIR_OLLAMA_URL,
        reasoning: process.env.MINATO_AI_REPAIR_REASONING,
      },
    },
    search: {
      profile: process.env.MINATO_SEARCH_ENGINE_PROFILE,
    },
  };
}
