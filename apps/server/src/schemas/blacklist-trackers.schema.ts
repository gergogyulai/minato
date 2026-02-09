import { z } from "zod";

export const AddBlacklistedTrackerSchema = z.object({
  urls: z
    .array(z.string())
    .min(1)
    .describe("Array of tracker URLs or patterns to blacklist"),
  reason: z.string().min(1).describe("Reason for blacklisting these trackers"),
});

export const AddBlacklistedTrackerResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

export const RemoveBlacklistedTrackerSchema = z.object({
  ids: z
    .array(z.string().uuid())
    .min(1)
    .describe("Array of blacklist entry IDs to remove"),
});

export const RemoveBlacklistedTrackerResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

export const ListBlacklistedTrackersResponseSchema = z.object({
  trackers: z.array(
    z.object({
      id: z.string().uuid(),
      urls: z.array(z.string()),
      reason: z.string(),
      createdAt: z.date(),
    }),
  ),
});

export type AddBlacklistedTrackerInput = z.infer<
  typeof AddBlacklistedTrackerSchema
>;
export type RemoveBlacklistedTrackerInput = z.infer<
  typeof RemoveBlacklistedTrackerSchema
>;
