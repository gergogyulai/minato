import { LevenshteinDistance } from "natural";
import { patterns, type ReleaseData } from "release-parser";

const NON_LATIN_RE = /[\u0400-\u04FF\u4E00-\u9FFF\u0600-\u06FF\u0900-\u097F\u3040-\u30FF\uAC00-\uD7AF\u0E00-\u0E7F]/;
const TEMPORAL_TYPES = new Set(["Movie", "TV", "Anime"]);
const SIMILARITY_THRESHOLD = 0.8;
const CURRENT_YEAR = new Date().getFullYear();

const FLAG_BLOCKLIST = new Set([
  "New", "Final", "Complete", "Convert", "Cover", "Serial", "Update",
  "Retail", "Limited", "Internal", "Hybrid", "Trailer", "Vertical",
  "Beta", "Portable",
]);

function extractTerms(
  dict: Record<string, string | string[]>,
  minLength: number = 2,
  blocklist: Set<string> = new Set()
): string[] {
  return Object.entries(dict).flatMap(([key, value]) => {
    if (blocklist.has(key)) return [];

    const patternsArray = Array.isArray(value) ? value : [value];

    return patternsArray
      .filter((pattern) => /^[\w.\-+|]+$/.test(pattern))
      .flatMap((pattern) => pattern.split("|"))
      .map((part) => part.trim())
      .filter((clean) => clean.length >= minLength);
  });
}

const TECH_LEAK_RE = (() => {
  type Dict = Record<string, string | string[]>;
  
  const sources = extractTerms(patterns.SOURCE as Dict);
  const formats = extractTerms(patterns.FORMAT as Dict);
  const resolutions = extractTerms(patterns.RESOLUTION as Dict);
  const audio = extractTerms(patterns.AUDIO as Dict);
  const flags = extractTerms(patterns.FLAGS as Dict, 3, FLAG_BLOCKLIST);

  const allTerms = new Set([...sources, ...formats, ...resolutions, ...audio, ...flags]);
  const escapedTerms = [...allTerms].map((t) => t.replace(/[.+]/g, "\\$&"));

  return new RegExp(`\\b(?:${escapedTerms.join("|")})\\b`, "i");
})();

const normalize = (s: string): string =>
  s.toLowerCase().replace(/[._-]/g, " ").replace(/\s+/g, " ").trim();

function similarityRatio(a: string, b: string): number {
  const normalizedA = normalize(a);
  const normalizedB = normalize(b);

  if (normalizedA === normalizedB) return 1.0;

  const maxLen = Math.max(normalizedA.length, normalizedB.length);
  if (maxLen === 0) return 1.0;

  return 1 - LevenshteinDistance(normalizedA, normalizedB) / maxLen;
}

function isPlausibleYear(year: number | string | null): boolean {
  if (year === null) return false;
  if (typeof year === "string") return /^(19\d[\dx]|20\d[\dx])$/i.test(year);
  
  return year >= 1888 && year <= CURRENT_YEAR + 1;
}

export function getReleaseConfidence(data: ReleaseData): "ok" | "low" {
  const { title, type, year, season, episode, date, release, group } = data;

  if (!title || title.trim().length < 2 || title.length > 60) return "low";
  if (NON_LATIN_RE.test(title)) return "low";

  if (TECH_LEAK_RE.test(title)) return "low";
  if (group && title.toLowerCase().endsWith(group.toLowerCase())) return "low";

  if (!type || type === "Unknown") return "low";
  if (similarityRatio(title, release) > SIMILARITY_THRESHOLD) return "low";
  if (year !== null && !isPlausibleYear(year)) return "low";

  if (TEMPORAL_TYPES.has(type)) {
    const hasValidYear = isPlausibleYear(year);
    const hasEpisodicContext = season !== null || episode !== null || date !== null;

    if (type === "Movie" && !hasValidYear) return "low";
    if (type === "TV" && !hasEpisodicContext) return "low";
    if (type === "Anime" && !hasValidYear && !hasEpisodicContext) return "low";
  }

  return "ok";
}