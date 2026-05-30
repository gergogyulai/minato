import type { NewEnrichment } from "@project-minato/db";
import type { MapperContext } from "@/lib/metadata/mappers/context";
import type { MovieMetadata } from "@/lib/metadata/types";

export function mapMovieMetadata(
	metadata: MovieMetadata,
	ctx: MapperContext,
): NewEnrichment {
	return {
		torrentInfoHash: ctx.infoHash,
		mediaType: "movie",
		tmdbId: metadata.tmdbId ?? null,
		imdbId: metadata.imdbId ?? null,
		tvdbId: null,
		anilistId: null,
		malId: null,
		mbId: null,
		discogsId: null,
		spotifyId: null,
		title: metadata.title,
		overview: metadata.overview ?? null,
		tagline: metadata.tagline ?? null,
		releaseDate: new Date(metadata.releaseDate),
		year: metadata.releaseYear,
		runtime: metadata.runtime ?? 0,
		status: metadata.status ?? "Released",
		genres: metadata.genres,
		contentRating: metadata.contentRating ?? null,
		provider: ctx.providerName,
		posterUrl: ctx.posterUrl,
		backdropUrl: ctx.backdropUrl,
		seriesDetails: {
			totalEpisodes: null,
			totalSeasons: null,
			episodeNumber: null,
			seasonNumber: null,
			episodeTitle: null,
		},
		musicDetails: null,
	};
}
