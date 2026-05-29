import { defineScheduledScraper } from "@project-minato/skit";
import type { TorrentInput } from "@project-minato/skit";

const ELASTIC_WINDOW = 10_000;

// All categories from the Knaben API (https://api.knaben.org/v1 categories endpoint).
// Parents are included alongside subcategories — they catch torrents tagged only at
// parent level; the seenHashes Set handles overlaps cheaply during deduplication.
const ALL_CATEGORIES = [
  { id: 1000000, name: "Audio" },
  { id: 1001000, name: "MP3" },
  { id: 1001001, name: "MP3 - Alternative & Nu-metal" },
  { id: 1001002, name: "MP3 - Alternative, Punk, Independent" },
  { id: 1001003, name: "MP3 - AOR (Melodic Hard Rock, Arena rock)" },
  { id: 1001004, name: "MP3 - Avant-garde, Experimental Metal" },
  { id: 1001005, name: "MP3 - Avant-garde, Experimental Rock" },
  { id: 1001006, name: "MP3 - Black" },
  { id: 1001007, name: "MP3 - Breakbeat" },
  { id: 1001008, name: "MP3 - Chillout, Lounge, Downtempo" },
  { id: 1001009, name: "MP3 - Classic Rock & Hard Rock" },
  { id: 1001010, name: "MP3 - Country, Bluegrass" },
  { id: 1001011, name: "MP3 - Cyberpunk, 8-bit, Chiptune" },
  { id: 1001012, name: "MP3 - Dancehall, Raggamuffin" },
  { id: 1001013, name: "MP3 - Darkwave, Neoclassical, Ethereal, Dungeon Synth" },
  { id: 1001014, name: "MP3 - Death, Doom" },
  { id: 1001015, name: "MP3 - Disco, Italo-Disco, Euro-Disco, Hi-NRG" },
  { id: 1001016, name: "MP3 - Drum & Bass, Jungle" },
  { id: 1001017, name: "MP3 - Dub" },
  { id: 1001018, name: "MP3 - Dubstep" },
  { id: 1001019, name: "MP3 - Easy Listening, Instrumental Pop" },
  { id: 1001020, name: "MP3 - EBM, Dark Electro, Aggrotech" },
  { id: 1001021, name: "MP3 - Electro, Electro-Freestyle, Nu Electro" },
  { id: 1001022, name: "MP3 - Emocore, Post-hardcore, Metalcore" },
  { id: 1001023, name: "MP3 - Eurodance, Euro-House, Technopop" },
  { id: 1001024, name: "MP3 - Experimental" },
  { id: 1001025, name: "MP3 - Folk-Rock" },
  { id: 1001026, name: "MP3 - Folk, Pagan, Viking" },
  { id: 1001027, name: "MP3 - Goa Trance, Psy-Trance" },
  { id: 1001029, name: "MP3 - Gothic Metal" },
  { id: 1001030, name: "MP3 - Gothic Rock & Dark Folk" },
  { id: 1001031, name: "MP3 - Grind, Brutal Death" },
  { id: 1001032, name: "MP3 - Hardcore" },
  { id: 1001033, name: "MP3 - Hardcore, Hardstyle, Jumpstyle" },
  { id: 1001034, name: "MP3 - Heavy, Power, Progressive" },
  { id: 1001035, name: "MP3 - House" },
  { id: 1001036, name: "MP3 - IDM" },
  { id: 1001037, name: "MP3 - Indie, Post-Rock & Post-Punk" },
  { id: 1001038, name: "MP3 - Industrial & Post-industrial" },
  { id: 1001039, name: "MP3 - Industrial, Noise" },
  { id: 1001040, name: "MP3 - Instrumental Guitar Rock" },
  { id: 1001041, name: "MP3 - Metal" },
  { id: 1001042, name: "MP3 - Modern Classical, Electroacoustic" },
  { id: 1001043, name: "MP3 - New Age & Meditative" },
  { id: 1001044, name: "MP3 - Nu Jazz, Acid Jazz, Future Jazz" },
  { id: 1001045, name: "MP3 - Pop-Rock & Soft Rock" },
  { id: 1001046, name: "MP3 - Progressive & Art-Rock" },
  { id: 1001047, name: "MP3 - PsyChill, Ambient, Dub" },
  { id: 1001048, name: "MP3 - Punk" },
  { id: 1001049, name: "MP3 - Reggae" },
  { id: 1001050, name: "MP3 - Rock" },
  { id: 1001051, name: "MP3 - Rockabilly, Psychobilly, Rock'n'Roll" },
  { id: 1001052, name: "MP3 - Ska-Punk, Ska-Core" },
  { id: 1001053, name: "MP3 - Sludge, Stoner, Post-Metal" },
  { id: 1001054, name: "MP3 - Synthpop, Futurepop, New Wave, Electropop" },
  { id: 1001055, name: "MP3 - Synthwave, Spacesynth, Dreamwave, Retrowave, Outrun" },
  { id: 1001056, name: "MP3 - Techno" },
  { id: 1001057, name: "MP3 - Thrash, Speed" },
  { id: 1001058, name: "MP3 - Traditional Electronic, Ambient" },
  { id: 1001059, name: "MP3 - Trance" },
  { id: 1001060, name: "MP3 - Trip Hop, Abstract Hip-Hop" },
  { id: 1001061, name: "MP3 - Chillout, Lounge, Downtempo, Trip-Hop" },
  { id: 1001062, name: "MP3 - Drum & Bass, Jungle, Breakbeat, Dubstep, IDM, Electro" },
  { id: 1001063, name: "MP3 - Eurodance, Disco, Hi-NRG" },
  { id: 1001064, name: "MP3 - House, Techno, Hardcore, Hardstyle, Jumpstyle" },
  { id: 1001065, name: "MP3 - Industrial, Noise, EBM, Dark Electro, Aggrotech, Cyberpunk, Synthpop, New Wave" },
  { id: 1001066, name: "MP3 - Label packs" },
  { id: 1001067, name: "MP3 - Reggae, Ska, Dub" },
  { id: 1001068, name: "MP3 - Traditional Electronic, Ambient, Modern Classical, Electroacoustic, Experimental" },
  { id: 1001069, name: "MP3 - Trance, Goa Trance, Psy-Trance, PsyChill, Ambient, Dub" },
  { id: 1002000, name: "Lossless" },
  { id: 1002001, name: "Lossless - Alternative & Nu-metal" },
  { id: 1002002, name: "Lossless - Alternative, Punk, Independent" },
  { id: 1002003, name: "Lossless - AOR (Melodic Hard Rock, Arena rock)" },
  { id: 1002004, name: "Lossless - Avant-Garde Jazz, Free Improvisation" },
  { id: 1002005, name: "Lossless - Avant-garde, Experimental Metal" },
  { id: 1002006, name: "Lossless - Avant-garde, Experimental Rock" },
  { id: 1002007, name: "Lossless - Black" },
  { id: 1002008, name: "Lossless - Blues (Texas, Chicago, Modern and Others)" },
  { id: 1002009, name: "Lossless - Blues-rock" },
  { id: 1002010, name: "Lossless - Bop" },
  { id: 1002011, name: "Lossless - Breakbeat" },
  { id: 1002012, name: "Lossless - Chillout, Lounge, Downtempo" },
  { id: 1002013, name: "Lossless - Classic Rock & Hard Rock" },
  { id: 1002014, name: "Lossless - Country, Bluegrass" },
  { id: 1002015, name: "Lossless - Darkwave, Neoclassical, Ethereal, Dungeon Synth" },
  { id: 1002016, name: "Lossless - Death, Doom" },
  { id: 1002017, name: "Lossless - Disco, Italo-Disco, Euro-Disco, Hi-NRG" },
  { id: 1002018, name: "Lossless - Drum & Bass, Jungle" },
  { id: 1002019, name: "Lossless - Dubstep" },
  { id: 1002020, name: "Lossless - Early Jazz, Swing, Gypsy" },
  { id: 1002021, name: "Lossless - Easy Listening, Instrumental Pop" },
  { id: 1002022, name: "Lossless - EBM, Dark Electro, Aggrotech" },
  { id: 1002023, name: "Lossless - Electro, Electro-Freestyle, Nu Electro" },
  { id: 1002024, name: "Lossless - Emocore, Post-hardcore, Metalcore" },
  { id: 1002025, name: "Lossless - Eurodance, Euro-House, Technopop" },
  { id: 1002026, name: "Lossless - Experimental" },
  { id: 1002027, name: "Lossless - Folk-Rock" },
  { id: 1002028, name: "Lossless - Folk, Pagan, Viking" },
  { id: 1002029, name: "Lossless - Funk, Soul, R&B" },
  { id: 1002030, name: "Lossless - Goa Trance, Psy-Trance" },
  { id: 1002031, name: "Lossless - Gothic Metal" },
  { id: 1002032, name: "Lossless - Gothic Rock & Dark Folk" },
  { id: 1002033, name: "Lossless - Grind, Brutal Death" },
  { id: 1002034, name: "Lossless - Hardcore" },
  { id: 1002035, name: "Lossless - Hardcore, Hardstyle, Jumpstyle" },
  { id: 1002036, name: "Lossless - Heavy, Power, Progressive" },
  { id: 1002037, name: "Lossless - House" },
  { id: 1002038, name: "Lossless - IDM" },
  { id: 1002039, name: "Lossless - Indie, Post-Rock & Post-Punk" },
  { id: 1002040, name: "Lossless - Industrial & Post-industrial" },
  { id: 1002041, name: "Lossless - Industrial, Noise" },
  { id: 1002042, name: "Lossless - Instrumental Guitar Rock" },
  { id: 1002043, name: "Lossless - Mainstream Jazz, Cool" },
  { id: 1002044, name: "Lossless - Metal" },
  { id: 1002045, name: "Lossless - Modern Classical, Electroacoustic" },
  { id: 1002046, name: "Lossless - Modern Creative, Third Stream" },
  { id: 1002047, name: "Lossless - New Age & Meditative" },
  { id: 1002048, name: "Lossless - Nu Jazz, Acid Jazz, Future Jazz" },
  { id: 1002049, name: "Lossless - Pop-Rock & Soft Rock" },
  { id: 1002050, name: "Lossless - Progressive & Art-Rock" },
  { id: 1002051, name: "Lossless - PsyChill, Ambient, Dub" },
  { id: 1002052, name: "Lossless - Punk" },
  { id: 1002053, name: "Lossless - Reggae, Dancehall, Dub" },
  { id: 1002054, name: "Lossless - Rock" },
  { id: 1002055, name: "Lossless - Rockabilly, Psychobilly, Rock'n'Roll" },
  { id: 1002056, name: "Lossless - Roots, Pre-War Blues, Early R&B, Gospel" },
  { id: 1002057, name: "Lossless - Ska, Ska-Punk, Ska-Jazz" },
  { id: 1002058, name: "Lossless - Sludge, Stoner, Post-Metal" },
  { id: 1002059, name: "Lossless - Smooth, Jazz-Pop" },
  { id: 1002060, name: "Lossless - Synthpop, Futurepop, New Wave, Electropop" },
  { id: 1002061, name: "Lossless - Synthwave, Spacesynth, Dreamwave, Retrowave, Outrun" },
  { id: 1002062, name: "Lossless - Techno" },
  { id: 1002063, name: "Lossless - Thrash, Speed" },
  { id: 1002064, name: "Lossless - Traditional Electronic, Ambient" },
  { id: 1002065, name: "Lossless - Trance" },
  { id: 1002066, name: "Lossless - Trip Hop, Abstract Hip-Hop" },
  { id: 1002067, name: "Lossless - Vocal Jazz" },
  { id: 1002068, name: "Lossless - World Fusion, Ethnic Jazz" },
  { id: 1002069, name: "Lossless - Label Packs" },
  { id: 1003000, name: "Audiobook" },
  { id: 1004000, name: "Audio / Video" },
  { id: 1005000, name: "Radio" },
  { id: 1006000, name: "Audio / Other" },
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
  { id: 4000000, name: "PC" },
  { id: 4001000, name: "PC / Games" },
  { id: 4002000, name: "PC / Software" },
  { id: 4003000, name: "PC / Mac" },
  { id: 4004000, name: "PC / Unix" },
  { id: 5000000, name: "XXX" },
  { id: 5001000, name: "XXX / Video" },
  { id: 5002000, name: "XXX / ImageSet" },
  { id: 5003000, name: "XXX / Games" },
  { id: 5004000, name: "Hentai" },
  { id: 5004001, name: "Hentai / Video" },
  { id: 5004002, name: "Hentai / Doujinshi" },
  { id: 5004003, name: "Hentai / Games" },
  { id: 5004004, name: "Hentai / Manga" },
  { id: 5004005, name: "Hentai / Pictures" },
  { id: 5005000, name: "XXX / Other" },
  { id: 6000000, name: "Anime" },
  { id: 6001000, name: "Anime / Subbed" },
  { id: 6002000, name: "Anime / Dubbed" },
  { id: 6003000, name: "Anime / Dual audio" },
  { id: 6004000, name: "Anime / Raw" },
  { id: 6005000, name: "Anime / Music Video" },
  { id: 6006000, name: "Anime / Literature" },
  { id: 6006001, name: "Anime / Literature - english translated" },
  { id: 6006002, name: "Anime / Literature - non-english translated" },
  { id: 6006003, name: "Anime / Literature - raw" },
  { id: 6007000, name: "Anime / Music" },
  { id: 6008000, name: "Anime / non-english translated" },
  { id: 7000000, name: "Console" },
  { id: 7001000, name: "Console / PS4" },
  { id: 7002000, name: "Console / PS3" },
  { id: 7003000, name: "Console / PS2" },
  { id: 7004000, name: "Console / PS1" },
  { id: 7005000, name: "Console / PS Vita" },
  { id: 7006000, name: "Console / PSP" },
  { id: 7007000, name: "Console / Xbox 360" },
  { id: 7008000, name: "Console / Xbox" },
  { id: 7009000, name: "Console / Switch" },
  { id: 7010000, name: "Console / NDS" },
  { id: 7011000, name: "Console / Wii" },
  { id: 7012000, name: "Console / WiiU" },
  { id: 7013000, name: "Console / 3DS" },
  { id: 7014000, name: "Console / GameCube" },
  { id: 7015000, name: "Console / Other" },
  { id: 8000000, name: "Mobile" },
  { id: 8001000, name: "Mobile / Android" },
  { id: 8002000, name: "Mobile / iOS" },
  { id: 8003000, name: "Mobile / Other" },
  { id: 9000000, name: "Books" },
  { id: 9001000, name: "Books / EBooks" },
  { id: 9002000, name: "Books / Comics" },
  { id: 9003000, name: "Books / Magazines" },
  { id: 9004000, name: "Books / Technical" },
  { id: 9005000, name: "Books / Other" },
  { id: 10000000, name: "Other" },
  { id: 10001000, name: "Other / Misc" },
];

// XXX category IDs used to filter adult content when hideXxx is true
const XXX_IDS = new Set([
  5000000, 5001000, 5002000, 5003000, 5004000,
  5004001, 5004002, 5004003, 5004004, 5004005, 5005000,
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
