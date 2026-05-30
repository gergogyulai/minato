import type { EnrichmentMetadata, MediaType } from "@/lib/providers/types/metadata";

export interface MetadataProvider {
	readonly name: string;
	readonly supportedTypes: ReadonlyArray<MediaType>;

	find(
		title: string,
		year?: number,
		type?: MediaType,
	): Promise<EnrichmentMetadata | null>;

	getAssetUrl?(path: string, type: "poster" | "backdrop"): string;
}
