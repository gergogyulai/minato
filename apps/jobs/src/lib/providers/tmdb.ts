import { TMDB } from "tmdb-ts";
import type { MetadataProvider } from "./types/provider";
import {
  calculateTitleSimilarity,
  TITLE_SIMILARITY_THRESHOLD,
} from "../common";

type BaseResult = {
  tmdb_id: number;
  title: string;
  release_date: string;
  release_year: number;
  overview: string;
  runtime: number | null;
  tagline: string | null;
  poster_path: string | null;
  backdrop_path: string | null;
  imdb_id: string | null;
  genres: string[];
};

export type TMDBMovieResult = BaseResult & {
  _type: "movie";
};

export type TMDBTvResult = BaseResult & {
  _type: "tv";
  tvdb_id: number | null;
  status: string;
  number_of_episodes: number;
  number_of_seasons: number;
};

export type TMDBFindResult = TMDBMovieResult | TMDBTvResult;

const TMDB_IMAGE_BASE_URL = "https://image.tmdb.org/t/p/";

export class TMDBProvider implements MetadataProvider<TMDBFindResult> {
  readonly name = "TMDB";
  readonly supportedTypes: ("movie" | "tv")[] = ["movie", "tv"];

  private client: TMDB;

  constructor(apiKey: string) {
    this.client = new TMDB(apiKey);
  }

  async find(
    title: string,
    year?: number,
    type: "movie" | "tv" = "movie",
  ): Promise<TMDBFindResult | null> {
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

    if (!searchItem) return null;

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

    if (isMovie) {
      const details = await this.client.movies.details(searchItem.id);
      const externalIds = await this.client.movies.externalIds(searchItem.id);
      const releaseDate = new Date(details.release_date);

      return {
        _type: "movie",
        tmdb_id: details.id,
        title: details.title,
        overview: details.overview,
        tagline: details.tagline,
        runtime: details.runtime,
        release_date: details.release_date,
        release_year: releaseDate.getFullYear(),
        poster_path: details.poster_path ?? null,
        backdrop_path: details.backdrop_path ?? null,
        imdb_id: externalIds.imdb_id ?? null,
        genres: details.genres.map((g) => g.name),
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
        _type: "tv",
        tmdb_id: details.id,
        title: details.name,
        overview: details.overview,
        tagline: details.tagline,
        runtime: medianRuntime ?? null,
        status: details.status,
        release_date: details.first_air_date,
        release_year: firstAirDate.getFullYear(),
        number_of_episodes: details.number_of_episodes,
        number_of_seasons: details.number_of_seasons,
        poster_path: details.poster_path ?? null,
        backdrop_path: details.backdrop_path ?? null,
        imdb_id: externalIds.imdb_id ?? null,
        tvdb_id: externalIds.tvdb_id ?? null,
        genres: details.genres.map((g) => g.name),
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
