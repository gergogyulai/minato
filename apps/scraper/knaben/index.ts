import type { TorrentInput } from "@project-minato/skit";
import { defineScheduledScraper } from "@project-minato/skit";

const ELASTIC_WINDOW = 10_000;

// All categories from the Knaben API (https://api.knaben.org/v1 categories endpoint).
// Parents are included alongside subcategories — they catch torrents tagged only at
// parent level; the seenHashes Set handles overlaps cheaply during deduplication.
const ALL_CATEGORIES = [
  { id: 1000000, name: "Audio" },
  { id: 1001000, name: "MP3" },
  { id: 1002000, name: "Lossless" },
  // { id: 1003000, name: "Audiobook" },
  // { id: 1004000, name: "Audio / Video" },
  // { id: 1005000, name: "Radio" },
  // { id: 1006000, name: "Audio / Other" },
  { id: 2000000, name: "TV" },
  { id: 2001000, name: "TV / HD" },
  { id: 2002000, name: "TV / SD" },
  { id: 2003000, name: "TV / UHD" },
  { id: 2004000, name: "TV / Documentary" },
  { id: 2005000, name: "TV / Foreign" },
  { id: 2006000, name: "TV / Sport" },
  { id: 2007000, name: "TV / Cartoon" },
  { id: 2008000, name: "TV / Other" },
  { id: 3000000, name: "Movies" },
  { id: 3001000, name: "Movies / HD" },
  { id: 3002000, name: "Movies / SD" },
  { id: 3003000, name: "Movies / UHD" },
  { id: 3004000, name: "Movies / DVD" },
  { id: 3005000, name: "Movies / Foreign" },
  { id: 3006000, name: "Movies / Bollywood" },
  { id: 3007000, name: "Movies / 3D" },
  { id: 3008000, name: "Movies / Other" },
  // { id: 4000000, name: "PC" },
  // { id: 4001000, name: "PC / Games" },
  // { id: 4002000, name: "PC / Software" },
  // { id: 4003000, name: "PC / Mac" },
  // { id: 4004000, name: "PC / Unix" },
  // { id: 5000000, name: "XXX" },
  // { id: 5001000, name: "XXX / Video" },
  // { id: 5002000, name: "XXX / ImageSet" },
  // { id: 5003000, name: "XXX / Games" },
  // { id: 5004000, name: "Hentai" },
  // { id: 5004001, name: "Hentai / Video" },
  // { id: 5004002, name: "Hentai / Doujinshi" },
  // { id: 5004003, name: "Hentai / Games" },
  // { id: 5004004, name: "Hentai / Manga" },
  // { id: 5004005, name: "Hentai / Pictures" },
  // { id: 5005000, name: "XXX / Other" },
  // { id: 6000000, name: "Anime" },
  // { id: 6001000, name: "Anime / Subbed" },
  // { id: 6002000, name: "Anime / Dubbed" },
  // { id: 6003000, name: "Anime / Dual audio" },
  // { id: 6004000, name: "Anime / Raw" },
  // { id: 6005000, name: "Anime / Music Video" },
  // { id: 6006000, name: "Anime / Literature" },
  // { id: 6006001, name: "Anime / Literature - english translated" },
  // { id: 6006002, name: "Anime / Literature - non-english translated" },
  // { id: 6006003, name: "Anime / Literature - raw" },
  // { id: 6007000, name: "Anime / Music" },
  // { id: 6008000, name: "Anime / non-english translated" },
  // { id: 7000000, name: "Console" },
  // { id: 7001000, name: "Console / PS4" },
  // { id: 7002000, name: "Console / PS3" },
  // { id: 7003000, name: "Console / PS2" },
  // { id: 7004000, name: "Console / PS1" },
  // { id: 7005000, name: "Console / PS Vita" },
  // { id: 7006000, name: "Console / PSP" },
  // { id: 7007000, name: "Console / Xbox 360" },
  // { id: 7008000, name: "Console / Xbox" },
  // { id: 7009000, name: "Console / Switch" },
  // { id: 7010000, name: "Console / NDS" },
  // { id: 7011000, name: "Console / Wii" },
  // { id: 7012000, name: "Console / WiiU" },
  // { id: 7013000, name: "Console / 3DS" },
  // { id: 7014000, name: "Console / GameCube" },
  // { id: 7015000, name: "Console / Other" },
  // { id: 8000000, name: "Mobile" },
  // { id: 8001000, name: "Mobile / Android" },
  // { id: 8002000, name: "Mobile / iOS" },
  // { id: 8003000, name: "Mobile / Other" },
  // { id: 9000000, name: "Books" },
  // { id: 9001000, name: "Books / EBooks" },
  // { id: 9002000, name: "Books / Comics" },
  // { id: 9003000, name: "Books / Magazines" },
  // { id: 9004000, name: "Books / Technical" },
  // { id: 9005000, name: "Books / Other" },
  // { id: 10000000, name: "Other" },
  // { id: 10001000, name: "Other / Misc" },
];


const AUDIO_CATEGORY_IDS = new Set([
	1000000, 1001000, 1002000, 1003000, 1004000, 1005000, 1006000,
]);

const TV_CATEGORY_IDS = new Set([
  2000000, 2001000, 2002000, 2003000, 2004000, 2005000, 2006000, 2007000,
  2008000,
]);


const MOVIE_CATEGORY_IDS = new Set([
  3000000, 3001000, 3002000, 3003000, 3004000, 3005000, 3006000, 3007000, 3008000
]);

const PC_CATEGORY_IDS = new Set([
	4000000, 4001000, 4002000, 4003000, 4004000,
]);

const XXX_IDS = new Set([
  5000000, 5001000, 5002000, 5003000, 5004000, 5004001, 5004002, 5004003,
  5004004, 5004005, 5005000,
]);

const ANIME_CATEGORY_IDS = new Set([
	6000000, 6001000, 6002000, 6003000, 6004000, 6005000, 6006000, 6006001,
	6006002, 6006003, 6007000, 6008000,
]);

const CONSOLE_CATEGORY_IDS = new Set([
	7000000, 7001000, 7002000, 7003000, 7004000, 7005000, 7006000, 7007000,
	7008000, 7009000, 7010000, 7011000, 7012000, 7013000, 7014000, 7015000,
]);

const MOBILE_CATEGORY_IDS = new Set([
	8000000, 8001000, 8002000, 8003000,
]);

const BOOK_CATEGORY_IDS = new Set([
	9000000, 9001000, 9002000, 9003000, 9004000, 9005000,
]);

const OTHER_CATEGORY_IDS = new Set([
	10000000, 10001000,
]);

// Sortable numeric/date fields. "title" is excluded — Knaben's title field is
// full-text analyzed and ES throws "fielddata disabled" on sort attempts.
const SORT_FIELDS = ["date", "seeders", "peers", "bytes"] as const;
type SortField = (typeof SORT_FIELDS)[number];

type KnabenConfig = {
  apiUrl: string[];
  pageSize: number;
  maxPagesPerCategory: number;
  hideUnsafe: boolean;
  hideXxx: boolean;
  sortFields: SortField[];
};

type KnabenHit = {
  bytes: number;
  cachedOrigin: string;
  category: string;
  categoryId: number[];
  date: string;
  details: string;
  hash: string | null;
  id: string;
  lastSeen: string;
  magnetUrl: string | null;
  link?: string;
  peers: number;
  score: number | null;
  seeders: number;
  title: string;
  tracker: string;
  trackerId: string;
  virusDetection: number;
};

type KnabenResponse = {
  max_score: number | null;
  total: {
    relation: string;
    value: number;
  };
  hits: KnabenHit[];
};

async function fetchPage(
  apiUrls: string[],
  from: number,
  size: number,
  categories: number[],
  orderBy: SortField,
  hideUnsafe: boolean,
  hideXxx: boolean,
  signal: AbortSignal,
): Promise<KnabenResponse> {
  const body = JSON.stringify({
    order_by: orderBy,
    order_direction: "desc",
    from,
    size,
    categories,
    hide_unsafe: hideUnsafe,
    hide_xxx: hideXxx,
  });

  let lastError: unknown;
  for (const base of apiUrls) {
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");
    try {
      const res = await fetch(base.replace(/\/$/, ""), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        signal,
      });
      if (res.ok) return res.json() as Promise<KnabenResponse>;
      lastError = new Error(`HTTP ${res.status} from ${base}`);
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError ?? new Error("All Knaben API URLs failed");
}

function toTorrentInput(hit: KnabenHit): TorrentInput {
  return {
    infoHash: hit.hash!,
    title: hit.title,
    size: hit.bytes,
    seeders: hit.seeders,
    leechers: hit.peers,
    magnet: hit.magnetUrl ?? undefined,
    category: hit.category,
    publishedAt: hit.date,
    source: {
      name: "Knaben",
      origin: hit.tracker,
      originUrl: hit.details,
      url: hit.link,
    },
  };
}

export default defineScheduledScraper<KnabenConfig>({
  recommendedSchedule: "0 3 * * *",
  config: {
    apiUrl: ["https://api.knaben.org/v1"],
    pageSize: 300,
    maxPagesPerCategory: 33, // 33 × 300 = 9,900 ≤ 10,000 (ES window limit)
    hideUnsafe: true,
    hideXxx: false,
    sortFields: ["date", "seeders", "peers", "bytes"],
  },
  async run({ config, ingest, status, signal }) {
    const seenHashes = new Set<string>();
    const maxPagesAllowed = Math.floor(ELASTIC_WINDOW / config.pageSize);
    const maxPerPass = Math.min(config.maxPagesPerCategory, maxPagesAllowed);

    const categories = config.hideXxx
      ? ALL_CATEGORIES.filter((c) => !XXX_IDS.has(c.id))
      : ALL_CATEGORIES;

    const total = categories.length * config.sortFields.length;
    let passIdx = 0;

    for (const cat of categories) {
      if (signal.aborted) break;

      for (const sortField of config.sortFields) {
        if (signal.aborted) break;
        passIdx++;

        status.update({
          phase: "running",
          message: `[${passIdx}/${total}] ${cat.name} / ${sortField}`,
          progress: { current: passIdx, total },
        });

        const first = await fetchPage(
          config.apiUrl,
          0,
          config.pageSize,
          [cat.id],
          sortField,
          config.hideUnsafe,
          config.hideXxx,
          signal,
        );

        const totalPages = Math.min(
          Math.ceil(first.total.value / config.pageSize),
          maxPerPass,
        );

        for (const hit of first.hits) {
          if (hit.hash && !seenHashes.has(hit.hash)) {
            seenHashes.add(hit.hash);
            ingest.add(toTorrentInput(hit));
          }
        }

        // Fewer results than a full page means we've exhausted this partition
        if (first.hits.length < config.pageSize) continue;

        for (let page = 2; page <= totalPages; page++) {
          if (signal.aborted) break;
          const from = (page - 1) * config.pageSize;
          if (from + config.pageSize > ELASTIC_WINDOW) break;

          const data = await fetchPage(
            config.apiUrl,
            from,
            config.pageSize,
            [cat.id],
            sortField,
            config.hideUnsafe,
            config.hideXxx,
            signal,
          );

          for (const hit of data.hits) {
            if (hit.hash && !seenHashes.has(hit.hash)) {
              seenHashes.add(hit.hash);
              ingest.add(toTorrentInput(hit));
            }
          }

          if (data.hits.length < config.pageSize) break;
        }
      }
    }

    status.update({ phase: "idle", message: "Scrape complete" });
  },
});
