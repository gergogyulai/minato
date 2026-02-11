import { GraphQLClient, gql } from "graphql-request";
import type { MetadataProvider } from "./types/provider";
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


export class AniListProvider implements MetadataProvider<any> {
  readonly name = "AniList";
  readonly supportedTypes: ("anime")[] = ["anime"];
  private client: GraphQLClient;

  constructor() {
    this.client = new GraphQLClient(ANILIST_API_URL);
  }

  async find(
    title: string,
    year?: number,
    type: "movie" | "tv" = "tv",
  ) {
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
    if (!searchItem) return null;

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

    return {
      _type: type,
      anilist_id: media.id,
      mal_id: media.idMal,
      title: media.title.english || media.title.romaji,
      overview: media.description?.replace(/<[^>]*>?/gm, "") ?? "",
      release_date: releaseDate,
      release_year: media.startDate.year,
      runtime: media.duration ?? null,
      poster_path: media.coverImage.extraLarge,
      backdrop_path: media.bannerImage,
      genres: media.genres,
      status: media.status,
      episodes: media.episodes,
      format: media.format,
      season: media.season,
    };
  }

  getAssetUrl(path: string): string {
    return path;
  }
}