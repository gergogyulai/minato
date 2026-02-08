import { z } from "zod";

export const BlacklistTorrentsSchema = z.object({
  infoHashes: z
    .array(z.string().length(40))
    .min(1)
    .describe("Array of 40-character info hashes to blacklist"),
  reason: z
    .string()
    .min(1)
    .describe("Reason for blacklisting these torrents"),
  deleteFromDatabase: z
    .boolean()
    .default(true)
    .describe("Whether to delete torrents from database after blacklisting"),
});

export const BlacklistTorrentsResponseSchema = z.object({
  success: z.boolean(),
  blacklistedCount: z.number(),
  deletedCount: z.number(),
  message: z.string(),
  blacklistedHashes: z.array(z.string()),
});

export type BlacklistTorrentsInput = z.infer<typeof BlacklistTorrentsSchema>;
export type BlacklistTorrentsResponse = z.infer<typeof BlacklistTorrentsResponseSchema>;
