import { setDeep } from "./utils"
import { RANKING_PROFILES_OPTIONS } from "@project-minato/meilisearch"

type Parser<T = unknown> = (raw: string, env: string) => T | undefined

const parseString: Parser<string> = (raw) => raw

const parseBool: Parser<boolean> = (raw, env) => {
  if (raw === "true" || raw === "1") return true
  if (raw === "false" || raw === "0") return false
  console.warn(`[config] ${env}=${raw} is not a valid boolean — ignoring`)
}

const parseCsv: Parser<string[]> = (raw) =>
  raw.split(",").map((s) => s.trim()).filter(Boolean)

function makeIntParser(min: number, max: number): Parser<number> {
  return (raw, env) => {
    const n = Number.parseInt(raw, 10)
    if (Number.isNaN(n)) {
      console.warn(`[config] ${env}=${raw} is not a valid integer — ignoring`)
      return undefined
    }
    if (n < min || n > max) {
      console.warn(`[config] ${env}=${raw} is out of range [${min}, ${max}] — ignoring`)
      return undefined
    }
    return n
  }
}

function makeEnumParser<T extends string>(
  values: readonly T[],
): Parser<T> {
  return (raw, env) => {
    if (values.includes(raw as T)) return raw as T
    console.warn(
      `[config] ${env}=${raw} is not one of [${values.join(", ")}] — ignoring`,
    )
  }
}

const ENV_MAP: Record<string, [path: string, parse: Parser]> = {
  MINATO_FLARESOLVERR_URL:               ["scraper.flareSolverrUrl",        parseString         ],
  MINATO_ENABLED_SCRAPERS:               ["scraper.enabledScrapers",        parseCsv            ],
  MINATO_WORKERS_INGEST_CONCURRENCY:     ["workers.ingest.concurrency",     makeIntParser(1, 50)],
  MINATO_WORKERS_ENRICHMENT_CONCURRENCY: ["workers.enrichment.concurrency", makeIntParser(1, 20)],
  MINATO_SEARCH_ENGINE_PROFILE:           ["search.profile",           makeEnumParser(RANKING_PROFILES_OPTIONS)],
}

export function readEnvOverrides(): Record<string, unknown> {
  let overrides: Record<string, unknown> = {}

  for (const [env, [path, parse]] of Object.entries(ENV_MAP)) {
    const raw = process.env[env]
    if (!raw) continue

    const value = parse(raw, env)
    if (value !== undefined) overrides = setDeep(overrides, path, value)
  }

  return overrides
}