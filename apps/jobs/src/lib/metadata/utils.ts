import type { EnrichmentMetadata } from "./types";

export function getAssetId(metadata: EnrichmentMetadata): string {
	switch (metadata.mediaType) {
		case "movie":
		case "tv":
			if (metadata.tmdbId) return `tmdb-${metadata.tmdbId}`;
			if (metadata.imdbId) return `imdb-${metadata.imdbId}`;
			break;
		case "anime":
			if (metadata.anilistId) return `anilist-${metadata.anilistId}`;
			if (metadata.malId) return `mal-${metadata.malId}`;
			break;
		case "music":
			if (metadata.mbId) return `mb-${metadata.mbId}`;
			break;
	}
	return metadata.title.replace(/[^a-z0-9]/gi, "_").toLowerCase();
}