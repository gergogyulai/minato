import type { MetadataResolver } from "@/lib/metadata/resolver";
import type { EnrichmentMetadata } from "@/lib/metadata/types";
import { getAssetId } from "@/lib/metadata/utils";
import { getLocalAssetPaths, ingestAsset } from "@/utils/media";

export interface AssetUrls {
	posterUrl: string | null;
	backdropUrl: string | null;
}

export async function downloadAssets(
	metadata: EnrichmentMetadata,
	providerName: string,
	resolver: MetadataResolver,
): Promise<AssetUrls> {
	const assetId = getAssetId(metadata);

	const backdropPath = "backdropPath" in metadata ? metadata.backdropPath : null;
	const artworkPath = metadata.mediaType === "music" ? metadata.albumCoverPath : metadata.posterPath;

	const [posterResult, backdropResult] = await Promise.allSettled([
		artworkPath
			? ingestAsset({
					id: assetId,
					url: resolver.getAssetUrl(providerName, artworkPath, "poster") ?? artworkPath,
					type: "poster",
				})
			: Promise.resolve(null),
		backdropPath
			? ingestAsset({
					id: assetId,
					url: resolver.getAssetUrl(providerName, backdropPath, "backdrop") ?? backdropPath,
					type: "backdrop",
				})
			: Promise.resolve(null),
	]);

	return {
		posterUrl: posterResult.status === "fulfilled" && posterResult.value
			? getLocalAssetPaths(assetId, "poster").relative
			: null,
		backdropUrl: backdropResult.status === "fulfilled" && backdropResult.value
			? getLocalAssetPaths(assetId, "backdrop").relative
			: null,
	};
}
