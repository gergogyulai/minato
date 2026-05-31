import { ORPCError } from "@orpc/server";
import { auth } from "@project-minato/auth";
import {
	apiKeyCreateContract,
	apiKeyDeleteContract,
	apiKeyListContract,
} from "@/api/contracts/api-keys.contracts";

export const apiKeysRouter = {
	create: apiKeyCreateContract.handler(async ({ input, context }) => {
		const result = await auth.api.createApiKey({
			body: {
				name: input.name,
				metadata: { type: input.type },
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
