import { defineScraper } from "@project-minato/skit";
import type { TorrentInput } from "@project-minato/skit";

type EztvConfig = {
  baseUrl: string[];
};

type EztvTorrent = {
  id: number;
  hash: string;
  filename: string;
  magnet_url: string;
  title: string;
  imdb_id: string;
  season: string;
  episode: string;
  seeds: number;
  peers: number;
  date_released_unix: number;
  size_bytes: string;
};

type EztvResponse = {
  torrents_count: number;
  limit: number;
  page: number;
  torrents: EztvTorrent[];
};

const LIMIT = 100;
const MAX_PAGES = 100;

async function fetchPage(
  baseUrls: string[],
  page: number,
  signal: AbortSignal,
): Promise<EztvResponse> {
  const path = `/api/get-torrents?limit=${LIMIT}&page=${page}`;
  let lastError: unknown;
  for (const base of baseUrls) {
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");
    const url = base.replace(/\/$/, "") + path;
    try {
      const res = await fetch(url, { signal });
      if (res.ok) return res.json() as Promise<EztvResponse>;
      lastError = new Error(`HTTP ${res.status} from ${url}`);
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError ?? new Error("All EZTV base URLs failed");
}

function toTorrentInput(t: EztvTorrent): TorrentInput {
  return {
    infoHash: t.hash,
    title: t.title,
    size: parseInt(t.size_bytes, 10),
    seeders: t.seeds,
    leechers: t.peers,
    magnet: t.magnet_url,
    publishedAt: t.date_released_unix
      ? new Date(t.date_released_unix * 1000).toISOString()
      : undefined,
    source: {
      name: "EZTV",
      origin: t.filename,
    },
  };
}

export default defineScraper<EztvConfig>({
  config: {
    baseUrl: [
      "https://eztvx.to",
      "https://eztv1.xyz",
      "https://eztv.wf",
      "https://eztv.tf",
      "https://eztv.yt",
    ],
  },
  async run({ config, ingest, status, signal, }) {
    status.update({ phase: "running", message: "Fetching first page" });

    const first = await fetchPage(config.baseUrl, 1, signal);
    const totalPages = Math.min(
      Math.ceil(first.torrents_count / LIMIT),
      MAX_PAGES,
    );

    for (const t of first.torrents) ingest.add(toTorrentInput(t));
    status.update({ phase: "running", progress: { current: 1, total: totalPages } });

    for (let page = 2; page <= totalPages; page++) {
      if (signal.aborted) break;
      const data = await fetchPage(config.baseUrl, page, signal);
      for (const t of data.torrents) ingest.add(toTorrentInput(t));
      status.update({ phase: "running", progress: { current: page, total: totalPages } });
    }

    status.update({ phase: "idle", message: "Scrape complete" });
  },
});
