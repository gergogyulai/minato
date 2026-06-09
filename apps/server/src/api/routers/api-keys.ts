import { ORPCError } from "@orpc/server";
import { auth } from "@project-minato/auth";
import { db, eq, scrapers } from "@project-minato/db";
import {
	apiKeyCreateContract,
	apiKeyDeleteContract,
	apiKeyListContract,
} from "@/api/contracts/api-keys.contracts";

export const apiKeysRouter = {
	create: apiKeyCreateContract.handler(async ({ input, context }) => {
		if (input.type === "sidecar") {
			// One key per sidecar identity, and never an id a managed scraper
			// already owns — the key would write into the wrong row.
			const [existing] = await db
				.select({ id: scrapers.id })
				.from(scrapers)
				.where(eq(scrapers.id, input.scraperId as string))
				.limit(1);
			if (existing) {
				throw new ORPCError("CONFLICT", {
					message: `Scraper id "${input.scraperId}" is already in use — remove that scraper first`,
				});
			}
		}

		const result = await auth.api.createApiKey({
			body: {
				name: input.name,
				metadata:
					input.type === "sidecar"
						? { type: input.type, scraperId: input.scraperId }
						: { type: input.type },
				expiresIn: input.expiresIn ?? null,
			},
			headers: context.honoContext.req.raw.headers,
		});

		return result;
	}),

	list: apiKeyListContract.handler(async ({ context }) => {
		const result = await auth.api.listApiKeys({
			headers: context.honoContext.req.raw.headers,
		});

		const apiKeys = result.apiKeys.filter((k) => {
			const meta = k.metadata as { type?: string } | null;
			return meta?.type !== "scraper";
		});

		return { apiKeys };
	}),

	delete: apiKeyDeleteContract.handler(async ({ input, context }) => {
		const list = await auth.api.listApiKeys({
			headers: context.honoContext.req.raw.headers,
		});

		const key = list.apiKeys.find((k) => k.id === input.keyId);
		if (!key) throw new ORPCError("NOT_FOUND", { message: "API key not found" });

		const meta = key.metadata as { type?: string } | null;
		if (meta?.type === "scraper") {
			throw new ORPCError("FORBIDDEN", {
				message: "Scraper keys cannot be managed through the UI",
			});
		}

		try {
			await auth.api.deleteApiKey({
				body: { keyId: input.keyId },
				headers: context.honoContext.req.raw.headers,
			});
			return { success: true };
		} catch {
			throw new ORPCError("NOT_FOUND", { message: "API key not found" });
		}
	}),
};
