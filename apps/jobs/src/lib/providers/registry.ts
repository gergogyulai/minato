import type { MetadataProvider } from "./types/provider";
import type { EnrichmentMetadata } from "./types/metadata";

/**
 * Configuration for a provider in the registry
 */
export interface ProviderConfig {
  provider: MetadataProvider;
  priority: number; // Lower number = higher priority
  enabled: boolean;
}

/**
 * Configuration for registering a provider
 */
export interface RegisterProviderConfig {
  provider: MetadataProvider;
  priority?: number; // Default: 100
  enabled?: boolean; // Default: true
}

/**
 * Configuration for the ProviderRegistry constructor
 */
export interface ProviderRegistryConfig {
  providers?: RegisterProviderConfig[];
}

/**
 * Result from a provider search with metadata
 */
export interface ProviderSearchResult {
  metadata: EnrichmentMetadata;
  provider: {
    name: string;
    priority: number;
  };
}

/**
 * Provider Registry manages multiple metadata providers
 * and handles fallback logic when one provider fails
 */
export class ProviderRegistry {
  private providers: Map<string, ProviderConfig> = new Map();

  constructor(config: ProviderRegistryConfig = {}) {
    if (config.providers) {
      for (const providerConfig of config.providers) {
        this.register(providerConfig);
      }
    }
  }

  /**
   * Register a new provider
   */
  register(config: RegisterProviderConfig): void {
    const { provider, priority = 100, enabled = true } = config;
    this.providers.set(provider.name, {
      provider,
      priority,
      enabled,
    });
  }

  /**
   * Unregister a provider by name
   */
  unregister(providerName: string): boolean {
    return this.providers.delete(providerName);
  }

  /**
   * Enable or disable a provider
   */
  setEnabled(providerName: string, enabled: boolean): void {
    const config = this.providers.get(providerName);
    if (config) {
      config.enabled = enabled;
    }
  }

  /**
   * Get all registered providers, sorted by priority
   */
  getProviders(): ProviderConfig[] {
    return Array.from(this.providers.values())
      .filter((config) => config.enabled)
      .sort((a, b) => a.priority - b.priority);
  }

  /**
   * Get providers that support a specific content type
   */
  getProvidersForType(type: "movie" | "tv" | "anime"): ProviderConfig[] {
    return this.getProviders().filter((config) =>
      config.provider.supportedTypes.includes(type),
    );
  }

  /**
   * Get a specific provider by name
   */
  getProvider(providerName: string): MetadataProvider | null {
    const config = this.providers.get(providerName);
    return config?.enabled ? config.provider : null;
  }

  /**
   * Try to find metadata using multiple providers with fallback
   * Returns the first successful enrichment-ready result
   */
  async findWithFallback(
    title: string,
    year: number | null,
    type: "movie" | "tv" | "anime",
  ): Promise<ProviderSearchResult | null> {
    const providers = this.getProvidersForType(type);

    if (providers.length === 0) {
      console.log(
        `[ProviderRegistry] No providers available for type "${type}"`,
      );
      return null;
    }

    for (const config of providers) {
      const { provider, priority } = config;
      try {
        console.log(
          `[ProviderRegistry] Trying provider "${provider.name}" for "${title}" (${type})`,
        );

        const metadata = await provider.find(title, year ?? undefined, type);

        if (metadata) {
          console.log(
            `[ProviderRegistry] Successfully found metadata using "${provider.name}"`,
          );
          return {
            metadata,
            provider: {
              name: provider.name,
              priority: priority,
            },
          };
        }
      } catch (error) {
        console.error(
          `[ProviderRegistry] Provider "${provider.name}" failed:`,
          error,
        );
        // Continue to next provider
      }
    }

    console.log(
      `[ProviderRegistry] All providers exhausted for "${title}" (${type})`,
    );
    console.log(
      `[ProviderRegistry] All providers exhausted for "${title}" (${type})`,
    );
    return null;
  }

  /**
   * Get asset URL from a specific provider
   */
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
