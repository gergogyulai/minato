/**
 * Represents the possible search types for the Knaben API.
 */
export type SearchType = "score" | `${number}%`;

/**
 * Direction of the sort order.
 */
export type OrderDirection = "desc" | "asc";

/**
 * Valid fields to order results by.
 */
export type OrderBy = "seeders" | "peers" | "date" | "size" | "title";

/**
 * Fields available for specific text matching.
 */
export type SearchField = "title" | "description" | string;

/**
 * Request payload for the Knaben V1 API.
 */
export interface KnabenSearchRequest {
  /** search_type can either be score or a percentage value from 0% - 100% */
  search_type?: SearchType;
  /** If set, will match the query search on the set field. */
  search_field?: SearchField;
  /** The search query string. */
  query?: string;
  /** The field to order by. */
  order_by?: OrderBy;
  /** The direction to order by. Default is "desc". */
  order_direction?: OrderDirection;
  /** Array of category IDs to filter by. */
  categories?: number[];
  /** The scroll offset for pagination. */
  from?: number;
  /** The amount of results to return. Maximum size is 300. */
  size?: number;
  /** Filters out very old results and potential virus scores. Default true. */
  hide_unsafe?: boolean;
  /** To hide adult content or not. Default false. */
  hide_xxx?: boolean;
  /** Relative seconds since last seen by Knaben. */
  seconds_since_last_seen?: number;
}

/**
 * Individual torrent result (Hit).
 */
export interface KnabenHit {
  id: string;
  title: string;
  bytes: number;
  date: string;
  lastSeen: string;
  details: string;
  tracker: string;
  trackerId: string;
  category: string;
  categoryId: number[];
  seeders: number;
  peers: number;
  virusDetection: number;
  hash: string | null;
  magnetUrl: string | null;
  link?: string | null;
  cachedOrigin?: string;
  score: number | null;
}

/**
 * API Response structure.
 */
export interface KnabenSearchResponse {
  max_score: number | null;
  total: {
    relation: "eq" | "gte";
    value: number;
  };
  hits: KnabenHit[];
}

/**
 * Client for interacting with the Knaben API.
 */
class KnabenClient {
  private readonly baseUrl = "https://api.knaben.org/v1";

  /**
   * Internal constructor. Use the default export singleton for standard use.
   */
  constructor() {}

  /**
   * Performs a search against the Knaben database.
   * If no parameters are provided, it performs a GET request to fetch the latest 150 documents.
   *
   * @param params - Optional search parameters.
   * @returns A promise resolving to the search response.
   * @throws Error if the fetch request fails.
   */
  async search(params?: KnabenSearchRequest): Promise<KnabenSearchResponse> {
    const isPost = !!(params && Object.keys(params).length > 0);

    const options: RequestInit = {
      method: isPost ? "POST" : "GET",
      headers: {
        "Content-Type": "application/json",
      },
    };

    if (isPost) {
      options.body = JSON.stringify(params);
    }

    const response = await fetch(this.baseUrl, options);

    if (!response.ok) {
      throw new Error(
        `Knaben API error: ${response.status} ${response.statusText}`,
      );
    }

    return (await response.json()) as KnabenSearchResponse;
  }

  /**
   * Helper to fetch the most recent 150 torrents without any filters.
   */
  async getRecent(): Promise<KnabenSearchResponse> {
    return this.search();
  }
}

/**
 * Singleton instance of the KnabenClient.
 */
const knaben = new KnabenClient();

export default knaben;