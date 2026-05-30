import type { NewEnrichment } from "@project-minato/db";
import type { EnrichmentMetadata } from "@/lib/metadata/types";
import type { MapperContext } from "@/lib/metadata/mappers/context";
import { mapMovieMetadata } from "@/lib/metadata/mappers/movies";
import { mapTVMetadata } from "@/lib/metadata/mappers/tv";
import { mapAnimeMetadata } from "@/lib/metadata/mappers/anime";
import { mapMusicMetadata } from "@/lib/metadata/mappers/music";

export type { MapperContext } from "@/lib/metadata/mappers/context";

export function mapMetadata(
	metadata: EnrichmentMetadata,
	ctx: MapperContext,
): NewEnrichment {
	switch (metadata.mediaType) {
		case "movie":
			return mapMovieMetadata(metadata, ctx);
		case "tv":
			return mapTVMetadata(metadata, ctx);
		case "anime":
			return mapAnimeMetadata(metadata, ctx);
		case "music":
			return mapMusicMetadata(metadata, ctx);
	}
}
