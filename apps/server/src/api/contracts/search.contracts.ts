import { publicProcedure } from "..";
import { z } from "zod";
import type { MeiliTorrentDocument } from "@project-minato/meilisearch";

export const searchTorrentsContract = publicProcedure
  .route({
    method: "POST",
    path: "/search/torrents",
    summary: "Minato Unified Search",
    tags: ["search"],
  })
  .input(
    z.object({
      q: z.string().optional().default(""), // The "Magic Box"

      // Structured Overrides
      type: z.array(z.string()).optional(),
      resolution: z.array(z.string()).optional(),
      group: z.array(z.string()).optional(),
      genres: z.array(z.string()).optional(),
      year: z
        .object({
          min: z.number().optional(),
          max: z.number().optional(),
        })
        .optional(),
      size: z
        .object({ min: z.number().optional(), max: z.number().optional() })
        .optional(),
      seeders: z.number().optional(),
      
      sort: z
        .enum([
          "trackerTitle:asc", "trackerTitle:desc",
          "seeders:asc", "seeders:desc",
          "publishedAt:asc", "publishedAt:desc",
          "size:asc", "size:desc"
        ])
        .optional()
        .default("seeders:desc"),

      limit: z.number().min(1).max(500).default(50),
      offset: z.number().default(0),
    }),
  )
  .output(
    z.object({
	    hits: z.array(z.custom<MeiliTorrentDocument>()),
      totalHits: z.number(),
      facetDistribution: z.any().optional(),
      processingTimeMs: z.number(),
      // Helps UI understand how the string was parsed
      queryAnalysis: z.object({
        sourceFilter: z.string().nullable(),
        isIdentifierMatch: z.boolean(),
        identifierType: z.enum(["imdb", "tmdb"]).nullable(),
        sanitizedQuery: z.string(),
        appliedFilters: z.record(z.string(), z.string()).optional(),
        searchQuery: z.string(),
      }),
    }),
  );