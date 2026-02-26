import "dotenv/config";
import { createEnv } from "@t3-oss/env-core";
import { sharedSchema } from "./schema";

export const env = createEnv({
  server: {
    ...sharedSchema,
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
