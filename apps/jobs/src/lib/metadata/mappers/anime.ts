import type { NewEnrichment } from "@project-minato/db";
import type { MapperContext } from "@/lib/metadata/mappers/context";
import type { AnimeMetadata } from "@/lib/metadata/types";

export function mapAnimeMetadata(
	metadata: AnimeMetadata,
	ctx: MapperContext,
): NewEnrichment {
	return {
		torrentInfoHash: ctx.infoHash,
		mediaType: "anime",
		tmdbId: null,
		imdbId: null,
		tvdbId: null,
		anilistId: metadata.anilistId ?? null,
		malId: metadata.malId ?? null,
		mbId: null,
		discogsId: null,
		spotifyId: null,
		title: metadata.title,
		overview: metadata.overview ?? null,
		tagline: metadata.tagline ?? null,
		releaseDate: new Date(metadata.releaseDate),
		year: metadata.releaseYear,
		runtime: metadata.runtime ?? null,
		status: metadata.status ?? null,
		genres: metadata.genres,
		contentRating: metadata.contentRating ?? null,
		provider: ctx.providerName,
		posterUrl: ctx.posterUrl,
		backdropUrl: ctx.backdropUrl,
		seriesDetails: {
			totalEpisodes: metadata.totalEpisodes ?? null,
			totalSeasons: null,
			episodeNumber: ctx.episodeNumber ?? null,
			seasonNumber: ctx.seasonNumber ?? null,
			episodeTitle: null,
		},
		musicDetails: null,
	};
}
