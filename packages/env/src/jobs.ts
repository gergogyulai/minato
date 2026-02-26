import "dotenv/config";
import { z } from "zod";
import { createEnv } from "@t3-oss/env-core";
import { sharedSchema, tmdbAccessTokenSchema } from "./schema";

export const env = createEnv({
  server: {
    ...sharedSchema,
    TMDB_READ_ACCESS_TOKEN: tmdbAccessTokenSchema,
    REDIS_HOST: z.string().default("localhost"),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
