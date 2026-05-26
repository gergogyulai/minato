import type { ScraperDefinition } from "./types";

export { run } from "./runner";
export { FlareSolverr } from "@project-minato/api-clients";

export function defineScraper<TConfig>(
  definition: ScraperDefinition<TConfig>,
): ScraperDefinition<TConfig> {
  return definition;
}

export { ffetch, flareFetch } from "./minato-fetch";

export type {
  ScraperDefinition,
  ScraperContext,
  ScraperMeta,
  ScraperManifest,
  ScraperStatus,
  TorrentInput,
  IngestResult,
  IngestClient,
  StatusReporter,
  Capability,
} from "./types";
export type {
  FlareSolverrResponse,
  Solution,
  Cookie,
  RequestOptions,
  ProxyConfig,
} from "@project-minato/api-clients";
