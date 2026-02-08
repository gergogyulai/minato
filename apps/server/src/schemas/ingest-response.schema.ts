import { z } from "zod";

export const IngestTorrentsResponseSchema = z.object({
  count: z.number(),
  message: z.string(),
});

export type IngestTorrentsResponse = z.infer<typeof IngestTorrentsResponseSchema>;
