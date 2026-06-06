import natural from "natural";
import type { EnrichmentMetadata, MediaType } from "@/lib/metadata/types";

export abstract class MetadataProvider {
	abstract readonly name: string;
	abstract readonly supportedTypes: ReadonlyArray<MediaType>;

	protected readonly TITLE_SIMILARITY_THRESHOLD = 0.8;

	abstract find(
		title: string,
		year?: number,
		type?: MediaType,
	): Promise<EnrichmentMetadata | null>;

	getAssetUrl(path: string, _type?: "poster" | "backdrop"): string {
		return path;
	}

	protected calculateTitleSimilarity(title1: string, title2: string): number {
		return natural.JaroWinklerDistance(
			title1.toLowerCase(),
			title2.toLowerCase(),
		);
	}
}
