import { z } from "zod";
import { ORPCError } from "@orpc/server";
import { db } from "@project-minato/db";
import {
  configSchema,
  getVersion,
  getConfig,
  writeConfigKey,
} from "@project-minato/config";
import { protectedProcedure } from "../index";

const DOT_PATH_RE = /^[a-z][a-zA-Z0-9]*(\.[a-z][a-zA-Z0-9]*)+$/

function getSubSchema(dotPath: string): z.ZodTypeAny | null {
  const parts = dotPath.split(".")
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let node: any = configSchema
  for (const part of parts) {
    if (
      typeof node !== "object" ||
      node === null ||
      typeof node.shape !== "object" ||
      node.shape === null
    ) {
      return null
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    node = (node.shape as Record<string, unknown>)[part]
    if (!node) return null
  }
  return node as z.ZodTypeAny
}

export const adminRouter = {
  config: {
    update: protectedProcedure
      .input(
        z.object({
          key: z.string(),
          value: z.unknown(),
        }),
      )
      .handler(async ({ input }) => {
        const { key, value } = input

        if (!DOT_PATH_RE.test(key)) {
          throw new ORPCError("BAD_REQUEST", {
            message: `"${key}" is not a valid dot-path (e.g. "workers.ingest.concurrency").`,
          })
        }

        const subSchema = getSubSchema(key)
        if (!subSchema) {
          throw new ORPCError("BAD_REQUEST", { message: `Unknown config key: "${key}".` })
        }

        const parsed = subSchema.safeParse(value)
        if (!parsed.success) {
          throw new ORPCError("BAD_REQUEST", {
            message: `Invalid value for key "${key}": ${parsed.error.message}`,
          })
        }

        await writeConfigKey(db, key, parsed.data)
        return { success: true, key, version: getVersion() }
      }),

    get: protectedProcedure.handler(() => {
      return { config: getConfig(), version: getVersion() }
    }),
  },
}
