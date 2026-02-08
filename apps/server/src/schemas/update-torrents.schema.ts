import { z } from "zod";

export const UpdateTorrentSchema = z.object({
  infoHash: z
    .string()
    .length(40)
    .describe("The 40-character info hash of the torrent"),
  trackerTitle: z.string().optional().describe("Title from the tracker"),
  seeders: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe("Number of seeders"),
  leechers: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe("Number of leechers"),
  trackerCategory: z
    .string()
    .optional()
    .describe("Category from the tracker"),
  standardCategory: z
    .number()
    .int()
    .optional()
    .describe("Standardized category ID"),
  files: z
    .array(
      z.object({
        filename: z.string(),
        size: z.number().int(),
      }),
    )
    .optional()
    .describe("Array of file information"),
  magnet: z.string().optional().describe("Magnet link"),
  type: z.string().optional().describe("Release type (movie, tv, etc.)"),
  group: z.string().optional().describe("Release group"),
  resolution: z.string().optional().describe("Video resolution"),
  releaseTitle: z.string().optional().describe("Parsed release title"),
});

export const UpdateTorrentResponseSchema = z.object({
  success: z.boolean(),
  updatedFields: z.array(z.string()),
  message: z.string(),
});

export type UpdateTorrentInput = z.infer<typeof UpdateTorrentSchema>;
export type UpdateTorrentResponse = z.infer<typeof UpdateTorrentResponseSchema>;
