export const SUPPORTED_KV_KEYS = [
  "year",
  "res",
  "resolution",
  "group",
  "type",
  "season",
  "ep",
] as const;

export type SupportedKVKey = (typeof SUPPORTED_KV_KEYS)[number];

export interface QueryParserResult {
  original: string;
  sanitized: string;
  directive: string | null;
  filters: Partial<Record<SupportedKVKey, string>>;
  identifier: string | null;
  isIdentifierMatch: boolean;
}

/**
 * @param input The raw query string
 * @param dynamicDirectives Optional list of directives fetched from a DB
 */
export const parseMinatoQuery = (
  input: string,
  dynamicDirectives: string[] = [],
): QueryParserResult => {
  const cleanInput = input.trim();

  if (!cleanInput) {
    return {
      original: "",
      sanitized: "",
      directive: null,
      filters: {},
      identifier: null,
      isIdentifierMatch: false,
    };
  }

  const tokens = cleanInput.split(/\s+/);
  const metaTokens = new Set<string>();

  let directive: string | null = null;
  const filters: Partial<Record<SupportedKVKey, string>> = {};

  // 1. Detect Identifier (e.g., tt1234567 or tmdb:550)
  const idMatch = cleanInput.match(/^(tt\d{7,8}|tmdb:\d+)$/i)?.[0] || null;

  for (const token of tokens) {
    // 2. Parse !directives (!1337x)
    if (token.startsWith("!")) {
      const val = token.slice(1).toLowerCase();
      // Check against the dynamic list provided as an argument
      if (dynamicDirectives.map((d) => d.toLowerCase()).includes(val)) {
        directive = val;
        metaTokens.add(token);
        continue;
      }
    }

    // 3. Parse key:value (year:2024)
    if (token.includes(":")) {
      const [rawKey, ...valParts] = token.split(":");
      if (rawKey) {
        const normalizedKey = rawKey.toLowerCase();
        const value = valParts.join(":").toLowerCase();

        if ((SUPPORTED_KV_KEYS as readonly string[]).includes(normalizedKey)) {
          filters[normalizedKey as SupportedKVKey] = value;
          metaTokens.add(token);
          continue;
        }
      }
    }
  }

  const sanitized = tokens.filter((t) => !metaTokens.has(t)).join(" ");

  return {
    original: cleanInput,
    sanitized,
    directive,
    filters,
    identifier: idMatch,
    isIdentifierMatch: !!idMatch && tokens.length === 1,
  };
};