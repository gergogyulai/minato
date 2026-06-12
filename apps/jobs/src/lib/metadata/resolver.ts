import type { MetadataProvider } from "@/lib/metadata/provider";
import type { MetadataCache } from "@/lib/metadata/cache";
import type { EnrichmentMetadata, MediaType } from "@/lib/metadata/types";
import { logger } from "@project-minato/utils/logger";

const log = logger.child({ module: "MetadataResolver" });

export interface ProviderEntry {
	provider: MetadataProvider;
	priority: number;
}

export interface MetadataResult {
	metadata: EnrichmentMetadata;
	providerName: string;
}

export class MetadataResolver {
	private providers: ProviderEntry[];
	private cache?: MetadataCache;

	constructor(providers: ProviderEntry[], cache?: MetadataCache) {
		this.providers = [...providers].sort((a, b) => a.priority - b.priority);
		this.cache = cache;
	}

	async find(
		title: string,
		year: number | null,
		type: MediaType,
		preferredProviderName?: string | null,
		forceRefresh = false,
	): Promise<MetadataResult | null> {
		if (!forceRefresh && this.cache) {
			const cached = await this.cache.get(title, type, year);
			if (cached) {
				log.debug({ title, type, year }, "Cache hit");
				return cached;
			}
		}

		const result = await this.findFromProviders(title, year, type, preferredProviderName);

		if (result && this.cache) {
			await this.cache.set(title, type, year, result);
		}

		return result;
	}

	private async findFromProviders(
		title: string,
		year: number | null,
		type: MediaType,
		preferredProviderName?: string | null,
	): Promise<MetadataResult | null> {
		if (preferredProviderName) {
			const preferred = this.providers.find((e) => e.provider.name === preferredProviderName);
			if (preferred) {
				try {
					const metadata = await preferred.provider.find(title, year ?? undefined, type);
					if (metadata) {
						return { metadata, providerName: preferred.provider.name };
					}
				} catch (err) {
					log.warn({ err, provider: preferredProviderName }, "Preferred provider failed, falling back");
				}
			} else {
				log.warn({ provider: preferredProviderName }, "Preferred provider not found, falling back");
			}
		}

		return this.findByPriority(title, year, type);
	}

	getAssetUrl(
		providerName: string,
		path: string,
		type: "poster" | "backdrop",
	): string | null {
		const entry = this.providers.find((e) => e.provider.name === providerName);
		return entry?.provider.getAssetUrl(path, type) ?? null;
	}

	private async findByPriority(
		title: string,
		year: number | null,
		type: MediaType,
	): Promise<MetadataResult | null> {
		const candidates = this.forType(type);

		if (candidates.length === 0) {
			log.info({ type }, "No providers for type");
			return null;
		}

		for (const { provider } of candidates) {
			try {
				log.info({ provider: provider.name, title, type }, "Trying provider");
				const metadata = await provider.find(title, year ?? undefined, type);
				if (metadata) {
					log.info({ provider: provider.name }, "Metadata found");
					return { metadata, providerName: provider.name };
				}
			} catch (err) {
				log.error({ err, provider: provider.name }, "Provider failed");
			}
		}

		log.info({ title, type }, "All providers exhausted");
		return null;
	}

	private forType(type: MediaType): ProviderEntry[] {
		return this.providers.filter((e) => e.provider.supportedTypes.includes(type));
	}
}
