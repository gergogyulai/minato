import { meiliClient } from "@project-minato/meilisearch";
import { searchTorrentsContract } from "../contracts/search.contracts";

export const searchRouter = {
  searchTorrents: searchTorrentsContract.handler(async ({ input }) => {
    const index = meiliClient.index("torrents");

    // Build filter string
    const filters: string[] = [];

    // Array filters (OR within each, AND between different filters)
    if (input.type && input.type.length > 0) {
      const typeFilters = input.type.map((t) => `type = "${t}"`).join(" OR ");
      filters.push(`(${typeFilters})`);
    }

    if (input.resolution && input.resolution.length > 0) {
      const resolutionFilters = input.resolution
        .map((r) => `resolution = "${r}"`)
        .join(" OR ");
      filters.push(`(${resolutionFilters})`);
    }

    if (input.group && input.group.length > 0) {
      const groupFilters = input.group
        .map((g) => `group = "${g}"`)
        .join(" OR ");
      filters.push(`(${groupFilters})`);
    }

    if (input.genres && input.genres.length > 0) {
      const genreFilters = input.genres
        .map((g) => `enrichment.genres = "${g}"`)
        .join(" OR ");
      filters.push(`(${genreFilters})`);
    }

    // Range filters
    if (input.year) {
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

    // Perform search
    const result = await index.search(input.q, {
      filter: filterString,
      sort: input.sort ? [input.sort] : ["seeders:desc"],
      limit: input.limit,
      offset: input.offset,
      facets: [
        "type",
        "resolution",
        "group",
        "enrichment.genres",
        "enrichment.mediaType",
      ],
    });

    return {
      hits: result.hits,
      totalHits: result.estimatedTotalHits ?? 0,
      facetDistribution: result.facetDistribution,
      processingTimeMs: result.processingTimeMs,
    };
  }),
}