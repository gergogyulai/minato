import { publicProcedure } from "..";
import { z } from "zod";

export const searchTorrentsContract = publicProcedure
  .route({
    method: "POST",
    path: "/search/torrents",
    summary: "Search torrents",
    description:
      "Search for torrents using various filters and sorting options. Supports pagination for large result sets.",
    tags: ["search"],
  })
  .input(
    z.object({
      q: z.string().optional().default(""),

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
      seeders: z.number().optional(), // e.g. "at least X seeders"
      sort: z
        .enum([
          "trackerTitle:asc",
          "trackerTitle:desc",
          "releaseTitle:asc",
          "releaseTitle:desc",
          "seeders:asc",
          "seeders:desc",
          "leechers:asc",
          "leechers:desc",
          "size:asc",
          "size:desc",
          "publishedAt:asc",
          "publishedAt:desc",
          "createdAt:asc",
          "createdAt:desc",
          "updatedAt:asc",
          "updatedAt:desc",
        ])
        .optional()
        .default("seeders:desc"),

      limit: z.number().min(1).max(500).default(50),
      offset: z.number().default(0),
    }),
  )
  .output(
    z.object({
      hits: z.array(z.any()),
      totalHits: z.number(),
      facetDistribution: z.any().optional(),
      processingTimeMs: z.number(),
    }),
  );
