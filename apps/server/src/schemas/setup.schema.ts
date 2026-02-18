import { z } from "zod";

// Setup status
export const SetupProgressSchema = z.object({
  currentStep: z.enum(["admin", "scrapers", "flaresolverr"]),
  completedSteps: z.array(z.enum(["admin", "scrapers", "flaresolverr"])),
});

export const GetSetupStatusResponseSchema = z.object({
  setupCompleted: z.boolean(),
  hasAdminUser: z.boolean(),
  setupProgress: SetupProgressSchema.optional(),
});

export type SetupProgress = z.infer<typeof SetupProgressSchema>;
export type GetSetupStatusResponse = z.infer<typeof GetSetupStatusResponseSchema>;

// Create admin account
export const CreateAdminSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const CreateAdminResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

export type CreateAdminInput = z.infer<typeof CreateAdminSchema>;
export type CreateAdminResponse = z.infer<typeof CreateAdminResponseSchema>;

// Scrapers
export const ScraperSchema = z.object({
  id: z.string(),
  name: z.string(),
  enabled: z.boolean(),
  description: z.string().optional(),
});

export const GetScrapersResponseSchema = z.object({
  scrapers: z.array(ScraperSchema),
});

export const UpdateScrapersSchema = z.object({
  enabledScrapers: z.array(z.string()),
});

export const UpdateScrapersResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

export type Scraper = z.infer<typeof ScraperSchema>;
export type GetScrapersResponse = z.infer<typeof GetScrapersResponseSchema>;
export type UpdateScrapersInput = z.infer<typeof UpdateScrapersSchema>;
export type UpdateScrapersResponse = z.infer<typeof UpdateScrapersResponseSchema>;

// FlareSolverr
export const CheckFlareSolverrSchema = z.object({
  url: z.string().url("Invalid URL"),
});

export const CheckFlareSolverrResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  version: z.string().optional(),
});

export const UpdateFlareSolverrSchema = z.object({
  url: z.string().url("Invalid URL"),
});

export const UpdateFlareSolverrResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

export type CheckFlareSolverrInput = z.infer<typeof CheckFlareSolverrSchema>;
export type CheckFlareSolverrResponse = z.infer<typeof CheckFlareSolverrResponseSchema>;
export type UpdateFlareSolverrInput = z.infer<typeof UpdateFlareSolverrSchema>;
export type UpdateFlareSolverrResponse = z.infer<typeof UpdateFlareSolverrResponseSchema>;

// Update setup progress
export const UpdateSetupProgressSchema = z.object({
  currentStep: z.enum(["admin", "scrapers", "flaresolverr"]),
  completedSteps: z.array(z.enum(["admin", "scrapers", "flaresolverr"])),
});

export const UpdateSetupProgressResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

export type UpdateSetupProgressInput = z.infer<typeof UpdateSetupProgressSchema>;
export type UpdateSetupProgressResponse = z.infer<typeof UpdateSetupProgressResponseSchema>;

// Complete setup
export const CompleteSetupResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

export type CompleteSetupResponse = z.infer<typeof CompleteSetupResponseSchema>;
