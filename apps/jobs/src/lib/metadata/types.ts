export type MediaType = "movie" | "tv" | "anime" | "music";

export interface MovieMetadata {
	mediaType: "movie";
	title: string;
	overview: string;
	tagline?: string | null;
	releaseDate: string | null;
	releaseYear: number | null;
	status?: string;
	runtime?: number | null;
	genres: string[];
	contentRating?: string | null;
	posterPath?: string | null;
	backdropPath?: string | null;
	tmdbId?: number | null;
	imdbId?: string | null;
}

export interface TVMetadata {
	mediaType: "tv";
	title: string;
	overview: string;
	tagline?: string | null;
	releaseDate: string | null;
	releaseYear: number | null;
	status?: string;
	runtime?: number | null;
	genres: string[];
	contentRating?: string | null;
	posterPath?: string | null;
	backdropPath?: string | null;
	tmdbId?: number | null;
	imdbId?: string | null;
	tvdbId?: number | null;
	totalSeasons?: number | null;
	totalEpisodes?: number | null;
	episodeTitle?: string | null;
}

export interface AnimeMetadata {
	mediaType: "anime";
	title: string;
	overview: string;
	tagline?: string | null;
	releaseDate: string | null;
	releaseYear: number | null;
	status?: string;
	runtime?: number | null;
	genres: string[];
	contentRating?: string | null;
	posterPath?: string | null;
	backdropPath?: string | null;
	anilistId?: number | null;
	malId?: number | null;
	totalEpisodes?: number | null;
}

export interface MusicTrack {
	position?: string | null;
	title: string;
	duration?: string | null;
}

export interface MusicMetadata {
	mediaType: "music";
	title: string;
	overview?: string | null;
	releaseDate: string | null;
	releaseYear: number | null;
	genres: string[];
	status?: string;
	contentRating?: string | null;
	albumCoverPath?: string | null;
	mbId?: string | null;
	discogsId?: number | null;
	spotifyId?: string | null;
	artist?: string | null;
	trackCount?: number | null;
	tracklist?: MusicTrack[] | null;
}

export type EnrichmentMetadata =
	| MovieMetadata
	| TVMetadata
	| AnimeMetadata
	| MusicMetadata;
