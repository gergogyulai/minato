import "dotenv/config";
import { createEnv } from "@t3-oss/env-core";
import { sharedSchema, tmdbAccessTokenSchema } from "./schema";

export const env = createEnv({
  server: {
    ...sharedSchema,
    ...tmdbAccessTokenSchema,
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
