/**
 * Single unified metadata type that directly maps to enrichment schema
 * Providers return this type, eliminating intermediate transformations
 */
export interface EnrichmentMetadata {
  // Content identification
  mediaType: "movie" | "tv" | "anime";
  
  // Provider IDs (at least one required)
  tmdbId?: number | null;
  imdbId?: string | null;
  tvdbId?: number | null;
  anilistId?: number | null;
  malId?: number | null;
  
  // Basic info
  title: string;
  overview: string;
  tagline?: string | null;
  releaseDate: string; // ISO date string
  releaseYear: number;
  status?: string; // "Released", "Ongoing", etc.
  
  // Media details
  runtime?: number | null;
  genres: string[];
  contentRating?: string | null;
  
  // Assets (raw paths from provider, will be processed separately)
  posterPath?: string | null;
  backdropPath?: string | null;
  
  // TV/Anime specific
  totalSeasons?: number | null;
  totalEpisodes?: number | null;
}

export function getAssetId(metadata: EnrichmentMetadata): string {
  if (metadata.tmdbId) return `tmdb-${metadata.tmdbId}`;
  if (metadata.anilistId) return `anilist-${metadata.anilistId}`;
  if (metadata.malId) return `mal-${metadata.malId}`;
  if (metadata.imdbId) return `imdb-${metadata.imdbId}`;
  
  return metadata.title.replace(/[^a-z0-9]/gi, "_").toLowerCase();
}
