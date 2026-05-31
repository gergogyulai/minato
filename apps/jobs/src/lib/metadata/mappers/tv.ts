import type { NewEnrichment } from "@project-minato/db";
import type { MapperContext } from "@/lib/metadata/mappers/context";
import type { TVMetadata } from "@/lib/metadata/types";

export function mapTVMetadata(
	metadata: TVMetadata,
	ctx: MapperContext,
): NewEnrichment {
	return {
		torrentInfoHash: ctx.infoHash,
		mediaType: "tv",
		tmdbId: metadata.tmdbId ?? null,
		imdbId: metadata.imdbId ?? null,
		tvdbId: metadata.tvdbId ?? null,
		anilistId: null,
		malId: null,
		mbId: null,
		discogsId: null,
		spotifyId: null,
		title: metadata.title,
		overview: metadata.overview ?? null,
		tagline: metadata.tagline ?? null,
		releaseDate: metadata.releaseDate ? new Date(metadata.releaseDate) : null,
		year: metadata.releaseYear ?? null,
		runtime: metadata.runtime ?? null,
		status: metadata.status ?? "Released",
		genres: metadata.genres,
		contentRating: metadata.contentRating ?? null,
		provider: ctx.providerName,
		posterUrl: ctx.posterUrl,
		backdropUrl: ctx.backdropUrl,
		seriesDetails: {
			totalEpisodes: metadata.totalEpisodes ?? null,
			totalSeasons: metadata.totalSeasons ?? null,
			episodeNumber: ctx.episodeNumber ?? null,
			seasonNumber: ctx.seasonNumber ?? null,
			episodeTitle: metadata.episodeTitle ?? null,
		},
		musicDetails: null,
	};
}
