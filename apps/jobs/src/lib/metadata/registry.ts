import type { MetadataProvider } from "@/lib/metadata/provider";
import type { EnrichmentMetadata, MediaType } from "@/lib/metadata/types";
import { logger } from "@/utils/logger";

const log = logger.child({ module: "ProviderRegistry" });

export interface ProviderConfig {
	provider: MetadataProvider;
	priority: number;
	enabled: boolean;
}

export interface RegisterProviderConfig {
	provider: MetadataProvider;
	priority?: number;
	enabled?: boolean;
}

export interface ProviderRegistryConfig {
	providers?: RegisterProviderConfig[];
}

export interface ProviderSearchResult {
	metadata: EnrichmentMetadata;
	provider: {
		name: string;
		priority: number;
	};
}

export class ProviderRegistry {
	private providers: Map<string, ProviderConfig> = new Map();

	constructor(config: ProviderRegistryConfig = {}) {
		if (config.providers) {
			for (const providerConfig of config.providers) {
				this.register(providerConfig);
			}
		}
	}

	register(config: RegisterProviderConfig): void {
		const { provider, priority = 100, enabled = true } = config;
		this.providers.set(provider.name, {
			provider,
			priority,
			enabled,
		});
	}

	unregister(providerName: string): boolean {
		return this.providers.delete(providerName);
	}

	setEnabled(providerName: string, enabled: boolean): void {
		const config = this.providers.get(providerName);
		if (config) {
			config.enabled = enabled;
		}
	}

	getProviders(): ProviderConfig[] {
		return Array.from(this.providers.values())
			.filter((config) => config.enabled)
			.sort((a, b) => a.priority - b.priority);
	}

	getProvidersForType(type: MediaType): ProviderConfig[] {
		return this.getProviders().filter((config) =>
			config.provider.supportedTypes.includes(type),
		);
	}

	getProvider(providerName: string): MetadataProvider | null {
		const config = this.providers.get(providerName);
		return config?.enabled ? config.provider : null;
	}

	async findWithFallback(
		title: string,
		year: number | null,
		type: MediaType,
	): Promise<ProviderSearchResult | null> {
		const providers = this.getProvidersForType(type);

		if (providers.length === 0) {
			log.info({ type }, "No providers available for type");
			return null;
		}

		for (const config of providers) {
			const { provider, priority } = config;
			try {
				log.info({ provider: provider.name, title, type }, "Trying provider");

				const metadata = await provider.find(title, year ?? undefined, type);

				if (metadata) {
					log.info({ provider: provider.name }, "Metadata found");
					return {
						metadata,
						provider: {
							name: provider.name,
							priority: priority,
						},
					};
				}
			} catch (error) {
				log.error({ err: error, provider: provider.name }, "Provider failed");
			}
		}

		log.info({ title, type }, "All providers exhausted");
		return null;
	}

	getAssetUrl(
		providerName: string,
		path: string,
		type: "poster" | "backdrop",
	): string | null {
		const provider = this.getProvider(providerName);
		if (!provider?.getAssetUrl) {
			return null;
		}
		return provider.getAssetUrl(path, type);
	}
}
