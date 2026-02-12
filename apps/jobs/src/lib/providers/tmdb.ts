import { TMDB } from "tmdb-ts";
import type { MetadataProvider } from "./types/provider";
import type { EnrichmentMetadata } from "./types/metadata";
import {
  calculateTitleSimilarity,
  TITLE_SIMILARITY_THRESHOLD,
} from "../common";

const TMDB_IMAGE_BASE_URL = "https://image.tmdb.org/t/p/";

export interface TMDBProviderConfig {
  apiKey: string;
}

export class TMDBProvider implements MetadataProvider {
  readonly name = "TMDB";
  readonly supportedTypes = ["movie", "tv"] as const;

  private client: TMDB;

  constructor(config: TMDBProviderConfig) {
    this.client = new TMDB(config.apiKey);
  }

  async find(
    title: string,
    year?: number,
    type: "movie" | "tv" = "movie",
  ): Promise<EnrichmentMetadata | null> {
    const isMovie = type === "movie";
    let searchItem: { id: number; compareTitle: string } | null = null;

    if (isMovie) {
      const res = await this.client.search.movies({ query: title, year });
      if (res.results[0]) {
        searchItem = {
          id: res.results[0].id,
          compareTitle: res.results[0].title,
        };
      }
    } else {
      const res = await this.client.search.tvShows({
        query: title,
        first_air_date_year: year,
      });
      if (res.results[0]) {
        searchItem = {
          id: res.results[0].id,
          compareTitle: res.results[0].name,
        };
      }
    }

    if (!searchItem) {
      return null;
    }

    const titleSimilarity = calculateTitleSimilarity(
      title,
      searchItem.compareTitle,
    );
    if (titleSimilarity < TITLE_SIMILARITY_THRESHOLD) {
      console.log(
        `[TMDBProvider] Title similarity (${titleSimilarity}) for "${title}" is below threshold for TMDB result "${searchItem.compareTitle}"`,
      );
      return null;
    }

    // Fetch details and return enrichment-ready data
    if (isMovie) {
      const details = await this.client.movies.details(searchItem.id);
      const externalIds = await this.client.movies.externalIds(searchItem.id);
      const releaseDate = new Date(details.release_date);

      return {
        mediaType: "movie",
        tmdbId: details.id,
        imdbId: externalIds.imdb_id ?? null,
        title: details.title,
        overview: details.overview,
        tagline: details.tagline ?? null,
        releaseDate: details.release_date,
        releaseYear: releaseDate.getFullYear(),
        runtime: details.runtime ?? null,
        status: "Released",
        genres: details.genres.map((g) => g.name),
        posterPath: details.poster_path ?? null,
        backdropPath: details.backdrop_path ?? null,
      };
    } else {
      const details = await this.client.tvShows.details(searchItem.id);
      const externalIds = await this.client.tvShows.externalIds(searchItem.id);
      const firstAirDate = new Date(details.first_air_date);

      const medianRuntime = details.episode_run_time.length
        ? details.episode_run_time.sort()[
            Math.floor(details.episode_run_time.length / 2)
          ]
        : null;

      return {
        mediaType: "tv",
        tmdbId: details.id,
        imdbId: externalIds.imdb_id ?? null,
        tvdbId: externalIds.tvdb_id ?? null,
        title: details.name,
        overview: details.overview,
        tagline: details.tagline ?? null,
        releaseDate: details.first_air_date,
        releaseYear: firstAirDate.getFullYear(),
        runtime: medianRuntime ?? null,
        status: details.status,
        genres: details.genres.map((g) => g.name),
        posterPath: details.poster_path ?? null,
        backdropPath: details.backdrop_path ?? null,
        totalSeasons: details.number_of_seasons,
        totalEpisodes: details.number_of_episodes,
      };
    }
  }

  getAssetUrl(
    path: string,
    type: "poster" | "backdrop",
  ): string {
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;

    const sizes = {
      poster: "w500",
      backdrop: "w1280",
    };

    const size = sizes[type] || "original";
    if (!TMDB_IMAGE_BASE_URL) {
      throw new Error("TMDB_IMAGE_BASE_URL is not defined");
    }

    const baseUrl = TMDB_IMAGE_BASE_URL.endsWith("/")
      ? TMDB_IMAGE_BASE_URL.slice(0, -1)
      : TMDB_IMAGE_BASE_URL;

    return `${baseUrl}/${size}${normalizedPath}`;
  }
}
