import { GraphQLClient, gql } from "graphql-request";
import type { MetadataProvider } from "./types/provider";
import type { EnrichmentMetadata } from "./types/metadata";
import {
  calculateTitleSimilarity,
  TITLE_SIMILARITY_THRESHOLD,
} from "../common";

const ANILIST_API_URL = "https://graphql.anilist.co";

interface AniListSearchResponse {
  Page: {
    media: Array<{
      id: number;
      title: {
        romaji: string;
        english: string | null;
        native: string | null;
      };
    }>;
  };
}

interface AniListDetailResponse {
  Media: {
    id: number;
    idMal: number | null;
    title: {
      romaji: string;
      english: string | null;
    };
    description: string | null;
    startDate: {
      year: number;
      month: number | null;
      day: number | null;
    };
    status: string;
    format: string;
    episodes: number | null;
    duration: number | null;
    genres: string[];
    bannerImage: string | null;
    coverImage: {
      extraLarge: string | null;
    };
    season: string | null;
  };
}

export interface AniListProviderConfig {
  apiUrl?: string;
}

export class AniListProvider implements MetadataProvider {
  readonly name = "AniList";
  readonly supportedTypes = ["anime"] as const;
  private client: GraphQLClient;

  constructor(config: AniListProviderConfig = {}) {
    this.client = new GraphQLClient(config.apiUrl ?? ANILIST_API_URL);
  }

  async find(
    title: string,
    year?: number,
    _type: "movie" | "tv" | "anime" = "anime",
  ): Promise<EnrichmentMetadata | null> {
    const SEARCH_QUERY = gql`
      query ($search: String, $year: Int) {
        Page(perPage: 1) {
          media(search: $search, type: ANIME, seasonYear: $year) {
            id
            title {
              romaji
              english
              native
            }
          }
        }
      }
    `;

    const searchData = await this.client.request<AniListSearchResponse>(
      SEARCH_QUERY,
      { search: title, year },
    );

    const searchItem = searchData.Page.media[0];
    if (!searchItem) {
      return null;
    }

    // Check similarity
    const titlesToCompare = [
      searchItem.title.english,
      searchItem.title.romaji,
    ].filter((t): t is string => !!t);

    const bestSimilarity = Math.max(
      ...titlesToCompare.map((t) => calculateTitleSimilarity(title, t)),
    );

    if (bestSimilarity < TITLE_SIMILARITY_THRESHOLD) {
      return null;
    }

    const DETAIL_QUERY = gql`
      query ($id: Int) {
        Media(id: $id) {
          id
          idMal
          title {
            romaji
            english
          }
          description
          startDate {
            year
            month
            day
          }
          status
          format
          episodes
          duration
          genres
          bannerImage
          coverImage {
            extraLarge
          }
          season
        }
      }
    `;

    const detailData = await this.client.request<AniListDetailResponse>(
      DETAIL_QUERY,
      { id: searchItem.id },
    );

    const media = detailData.Media;
    const releaseDate = `${media.startDate.year}-${String(media.startDate.month || 1).padStart(2, "0")}-${String(media.startDate.day || 1).padStart(2, "0")}`;

    // Return enrichment-ready data
    return {
      mediaType: "anime",
      anilistId: media.id,
      malId: media.idMal ?? null,
      title: media.title.english || media.title.romaji,
      overview: media.description?.replace(/<[^>]*>?/gm, "") ?? "",
      tagline: null, // AniList doesn't provide taglines
      releaseDate,
      releaseYear: media.startDate.year,
      runtime: media.duration ?? null,
      status: media.status,
      genres: media.genres,
      posterPath: media.coverImage.extraLarge ?? null,
      backdropPath: media.bannerImage ?? null,
      totalEpisodes: media.episodes ?? null,
    };
  }

  getAssetUrl(path: string): string {
    return path;
  }
}