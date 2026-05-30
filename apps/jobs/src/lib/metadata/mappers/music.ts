import type { NewEnrichment } from "@project-minato/db";
import type { MapperContext } from "@/lib/metadata/mappers/context";
import type { MusicMetadata } from "@/lib/metadata/types";

export function mapMusicMetadata(
	metadata: MusicMetadata,
	ctx: MapperContext,
): NewEnrichment {
	return {
		torrentInfoHash: ctx.infoHash,
		mediaType: "music",
		tmdbId: null,
		imdbId: null,
		tvdbId: null,
		anilistId: null,
		malId: null,
		mbId: metadata.mbId ?? null,
		discogsId: metadata.discogsId ?? null,
		spotifyId: metadata.spotifyId ?? null,
		title: metadata.title,
		overview: metadata.overview ?? null,
		tagline: null,
		releaseDate: new Date(metadata.releaseDate),
		year: metadata.releaseYear,
		runtime: null,
		status: metadata.status ?? null,
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
		musicDetails: {
			artist: metadata.artist ?? null,
			trackCount: metadata.trackCount ?? null,
			tracklist: metadata.tracklist ?? null,
		},
	};
}
