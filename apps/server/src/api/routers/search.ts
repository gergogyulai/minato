import { meiliClient } from "@project-minato/meilisearch";
import { searchTorrentsContract } from "../contracts/search.contracts";
import { parseMinatoQuery } from "../../lib/search/parser";
import type { MeiliTorrentDocument } from "@project-minato/meilisearch";

export const searchRouter = {
  searchTorrents: searchTorrentsContract.handler(async ({ input }) => {
    const index = meiliClient.index("torrents");

    // Parse the query string to extract filters and directives
    // TODO: Pass dynamic directives (source names) from DB if available
    const parsed = parseMinatoQuery(input.q, []);

    // Build filter string
    const filters: string[] = [];

    // Apply parsed filters from query string (these override structured inputs)
    
    // Directive (source filter, e.g., !1337x)
    if (parsed.directive) {
      filters.push(`sourceNames = "${parsed.directive}"`);
    }

    // Type filter (parsed "type:movie" overrides structured input)
    const typeFilter = parsed.filters.type 
      ? [parsed.filters.type] 
      : (input.type && input.type.length > 0 ? input.type : null);
    
    if (typeFilter && typeFilter.length > 0) {
      const typeFilters = typeFilter.map((t) => `type = "${t}"`).join(" OR ");
      filters.push(`(${typeFilters})`);
    }

    // Resolution filter (parsed "res:1080p" or "resolution:1080p" overrides structured input)
    const resolutionFilter = parsed.filters.res || parsed.filters.resolution
      ? [parsed.filters.res || parsed.filters.resolution]
      : (input.resolution && input.resolution.length > 0 ? input.resolution : null);
    
    if (resolutionFilter && resolutionFilter.length > 0) {
      const resolutionFilters = resolutionFilter
        .map((r) => `resolution = "${r}"`)
        .join(" OR ");
      filters.push(`(${resolutionFilters})`);
    }

    // Group filter (parsed "group:yify" overrides structured input)
    const groupFilter = parsed.filters.group
      ? [parsed.filters.group]
      : (input.group && input.group.length > 0 ? input.group : null);
    
    if (groupFilter && groupFilter.length > 0) {
      const groupFilters = groupFilter
        .map((g) => `group = "${g}"`)
        .join(" OR ");
      filters.push(`(${groupFilters})`);
    }

    // Season filter (parsed "season:1")
    if (parsed.filters.season) {
      const seasonValue = Number.parseInt(parsed.filters.season, 10);
      if (!Number.isNaN(seasonValue)) {
        filters.push(`enrichment.seasonNumber = ${seasonValue}`);
      }
    }

    // Episode filter (parsed "ep:5")
    if (parsed.filters.ep) {
      const episodeValue = Number.parseInt(parsed.filters.ep, 10);
      if (!Number.isNaN(episodeValue)) {
        filters.push(`enrichment.episodeNumber = ${episodeValue}`);
      }
    }

    if (input.genres && input.genres.length > 0) {
      const genreFilters = input.genres
        .map((g) => `enrichment.genres = "${g}"`)
        .join(" OR ");
      filters.push(`(${genreFilters})`);
    }

    // Range filters
    // Year filter (parsed "year:2024" can override structured input)
    if (parsed.filters.year) {
      const yearValue = Number.parseInt(parsed.filters.year, 10);
      if (!Number.isNaN(yearValue)) {
        filters.push(`enrichment.year = ${yearValue}`);
      }
    } else if (input.year) {
      if (input.year.min !== undefined) {
        filters.push(`enrichment.year >= ${input.year.min}`);
      }
      if (input.year.max !== undefined) {
        filters.push(`enrichment.year <= ${input.year.max}`);
      }
    }

    if (input.size) {
      if (input.size.min !== undefined) {
        filters.push(`size >= ${input.size.min}`);
      }
      if (input.size.max !== undefined) {
        filters.push(`size <= ${input.size.max}`);
      }
    }

    if (input.seeders !== undefined) {
      filters.push(`seeders >= ${input.seeders}`);
    }

    const filterString = filters.length > 0 ? filters.join(" AND ") : undefined;

    // Handle identifier-based matching (IMDB/TMDB IDs)
    let searchQuery = parsed.sanitized || input.q;
    let attributesToSearchOn: string[] | undefined = undefined;

    if (parsed.isIdentifierMatch && parsed.identifier) {
      // Extract the identifier value
      if (parsed.identifier.toLowerCase().startsWith("tt")) {
        // IMDB ID (e.g., tt1234567)
        searchQuery = parsed.identifier.toLowerCase();
        attributesToSearchOn = ["enrichment.imdbId"];
      } else if (parsed.identifier.toLowerCase().startsWith("tmdb:")) {
        // TMDB ID (e.g., tmdb:550)
        const tmdbId = parsed.identifier.split(":")[1];
        searchQuery = tmdbId!;
        attributesToSearchOn = ["enrichment.tmdbId"];
      }
    }

    // Perform search
    const result = await index.search(searchQuery, {
      filter: filterString,
      sort: input.sort ? [input.sort] : ["seeders:desc"],
      limit: input.limit,
      offset: input.offset,
      attributesToSearchOn,
      facets: [
        "type",
        "resolution",
        "group",
        "sourceNames",
        "enrichment.genres",
        "enrichment.mediaType",
      ],
    });

    const analysis = {
      sourceFilter: parsed.directive,
      isIdentifierMatch: parsed.isIdentifierMatch,
      identifierType: (parsed.isIdentifierMatch 
        ? (parsed.identifier?.toLowerCase().startsWith("tt") ? "imdb" : "tmdb")
        : null) as "imdb" | "tmdb" | null,
      sanitizedQuery: parsed.sanitized,
      appliedFilters: parsed.filters,
      searchQuery: searchQuery as string,
    };

    return {
      hits: result.hits as MeiliTorrentDocument[],
      totalHits: result.estimatedTotalHits ?? 0,
      facetDistribution: result.facetDistribution,
      processingTimeMs: result.processingTimeMs,
      queryAnalysis: analysis,
    };
  }),
}