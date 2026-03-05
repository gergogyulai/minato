import "dotenv/config";
import { createEnv } from "@t3-oss/env-core";
import { sharedSchema } from "./schema";
import { z } from "zod";

export const env = createEnv({
  server: {
    ...sharedSchema,
    BETTER_AUTH_SECRET: z.string().min(1),
    BETTER_AUTH_URL: z.string().url().optional(),
    CORS_ORIGIN: z.string().url().optional(),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
