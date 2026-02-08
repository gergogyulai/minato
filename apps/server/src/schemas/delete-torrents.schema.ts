import { z } from "zod";

export const DeleteTorrentsSchema = z.object({
  infoHashes: z
    .array(z.string().length(40))
    .min(1)
    .describe("Array of 40-character info hashes to delete"),
});

export const DeleteTorrentsResponseSchema = z.object({
  success: z.boolean(),
  count: z.number(),
  message: z.string(),
  deletedHashes: z.array(z.string()),
});

export type DeleteTorrentsInput = z.infer<typeof DeleteTorrentsSchema>;
export type DeleteTorrentsResponse = z.infer<typeof DeleteTorrentsResponseSchema>;
