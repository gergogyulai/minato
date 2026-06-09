import { z } from "zod";
import { adminProcedure } from "@/api";

const apiKeyMetaSchema = z.object({
	id: z.string(),
	name: z.string().nullable(),
	start: z.string().nullable(),
	prefix: z.string().nullable(),
	referenceId: z.string(),
	enabled: z.boolean(),
	expiresAt: z.date().nullable(),
	createdAt: z.date(),
	updatedAt: z.date(),
	metadata: z.record(z.string(), z.unknown()).nullable(),
	permissions: z.record(z.string(), z.array(z.string())).nullable().optional(),
});

export const apiKeyCreateContract = adminProcedure
	.route({
		method: "POST",
		path: "/api-keys/create",
		summary: "Create an API key",
		tags: ["api-keys"],
	})
	.input(
		z
			.object({
				name: z.string().min(1).max(64),
				type: z.enum(["torznab", "rss", "custom", "sidecar"]),
				// Sidecar keys are bound to a scraper identity at creation — the key
				// is how the server knows which scraper is talking to it.
				scraperId: z
					.string()
					.regex(/^[a-z0-9][a-z0-9-]*$/, "lowercase letters, digits, dashes")
					.max(64)
					.optional(),
				expiresIn: z.number().int().positive().optional(),
			})
			.refine((v) => v.type !== "sidecar" || !!v.scraperId, {
				message: "scraperId is required for sidecar keys",
				path: ["scraperId"],
			}),
	)
	.output(
		apiKeyMetaSchema.extend({
			key: z.string(),
		}),
	);

export const apiKeyListContract = adminProcedure
	.route({
		method: "GET",
		path: "/api-keys",
		summary: "List API keys",
		tags: ["api-keys"],
	})
	.output(
		z.object({
			apiKeys: z.array(apiKeyMetaSchema),
		}),
	);

export const apiKeyDeleteContract = adminProcedure
	.route({
		method: "POST",
		path: "/api-keys/delete",
		summary: "Delete an API key",
		tags: ["api-keys"],
	})
	.input(
		z.object({
			keyId: z.string(),
		}),
	)
	.output(z.object({ success: z.boolean() }));
