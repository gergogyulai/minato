import type { EnrichmentMetadata } from "./metadata";

export interface MetadataProvider {
  readonly name: string;
  readonly supportedTypes: ReadonlyArray<"movie" | "tv" | "anime">;

  find(
    title: string,
    year?: number,
    type?: "movie" | "tv" | "anime"
  ): Promise<EnrichmentMetadata | null>;

  getAssetUrl?(
    path: string,
    type: "poster" | "backdrop",
  ): string;
}
