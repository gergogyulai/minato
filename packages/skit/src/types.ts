import type { FlareSolverr } from "@project-minato/api-clients";

export type { FlareSolverr };

export type Capability = "ingest" | "status" | "commands";

export type ScraperManifest = {
  id: string;
  name: string;
  version: string;
  author?: string;
  runtime?: "bun" | "node";
  entry: string;
  capabilities: Capability[];
  lifecycle?: "scheduled" | "daemon";
  defaultConfig?: Record<string, unknown>;
};

export type TorrentInput = {
  infoHash: string;
  title: string;
  size: number;
  seeders?: number;
  leechers?: number;
  magnet?: string;
  category?: string;
  publishedAt?: string;
  files?: Array<{ filename: string; size: number }>;
  source: {
    name: string;
    url?: string;
    origin?: string;
    originUrl?: string;
  };
};

export type IngestResult = {
  count: number;
  message: string;
};

export type ScraperStatus = {
  phase?: "idle" | "running" | "paused" | "error";
  progress?: { current: number; total?: number };
  message?: string;
};

export type ScraperMeta = {
  id: string;
  name: string;
  version: string;
};

export type IngestClient = {
  add(torrent: TorrentInput): void;
  flush(): Promise<void>;
};

export type StatusReporter = {
  update(status: ScraperStatus): void;
};

export type ScraperContext<TConfig = Record<string, unknown>> = {
  ingest: IngestClient;
  config: TConfig;
  signal: AbortSignal;
  status: StatusReporter;
  meta: ScraperMeta;
  /** FlareSolverr client pre-configured with Minato's registered instance URL. */
  flaresolverr: FlareSolverr;
};

export type ScraperDefinition<TConfig = Record<string, unknown>> = {
  config?: TConfig;
  run(ctx: ScraperContext<TConfig>): Promise<void>;
};
