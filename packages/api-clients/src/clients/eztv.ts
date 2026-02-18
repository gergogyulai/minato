/**
 * Represents a single torrent entry returned by the EZTV API.
 */
export interface EZTVTorrent {
  /** Internal EZTV database ID */
  id: number;
  /** Info hash of the torrent */
  hash: string;
  /** Full filename of the torrent */
  filename: string;
  /** URL to the episode page on EZTV */
  episode_url: string;
  /** Direct link to the .torrent file */
  torrent_url: string;
  /** Magnet link for the torrent */
  magnet_url: string;
  /** Clean title of the release */
  title: string;
  /** The IMDB ID associated with the show (numeric string) */
  imdb_id: string;
  /** Season number */
  season: string;
  /** Episode number */
  episode: string;
  /** URL to a small preview screenshot */
  small_screenshot: string;
  /** URL to a large preview screenshot */
  large_screenshot: string;
  /** Number of active seeds */
  seeds: number;
  /** Number of active peers (leechers) */
  peers: number;
  /** Release date in Unix timestamp format */
  date_released_unix: number;
  /** File size in bytes (as a string) */
  size_bytes: string;
}

/**
 * The standard response object returned by the EZTV API.
 */
export interface EZTVResponse {
  /** The IMDB ID queried (if applicable) */
  imdb_id: string;
  /** Total number of torrents found for this query */
  torrents_count: number;
  /** The results per page limit used for the request */
  limit: number;
  /** The current page number of the results */
  page: number;
  /** Array of torrent objects */
  torrents: EZTVTorrent[];
}

/**
 * Parameters for the getTorrents request.
 */
export interface GetTorrentsParams {
  /** 
   * Number of results per page. 
   * @constraint Between 1 and 100 
   */
  limit?: number;
  /** 
   * Current page of results. 
   * @constraint Between 1 and 100 
   */
  page?: number;
  /** 
   * The IMDB ID of the show. Can include or exclude the 'tt' prefix.
   * If provided, the API returns only torrents for this specific show.
   */
  imdb_id?: string | number;
  /** 
   * Overrides the default EZTV API endpoint.
   * Useful for proxies or alternative mirrors.
   * @default "https://eztvx.to/api/get-torrents"
   */
  baseUrl?: string;
}

const DEFAULT_BASE_URL = "https://eztvx.to/api/get-torrents";

/**
 * Fetches torrent data from the EZTV API.
 * 
 * This is a functional wrapper that does not require instantiation.
 * 
 * @example
 * ```ts
 * const data = await getTorrents({ imdb_id: 'tt6048596', limit: 10 });
 * ```
 * 
 * @param params - Configuration for the request including pagination and filters.
 * @returns A promise resolving to the EZTV API response.
 * @throws {Error} If limit/page are out of bounds or if the network request fails.
 */
export const getTorrents = async (
  params: GetTorrentsParams = {}
): Promise<EZTVResponse> => {
  const { 
    limit, 
    page, 
    imdb_id, 
    baseUrl = DEFAULT_BASE_URL 
  } = params;

  // Validation of API constraints
  if (limit && (limit < 1 || limit > 100)) {
    throw new Error("EZTV API Error: Limit must be between 1 and 100.");
  }
  if (page && (page < 1 || page > 100)) {
    throw new Error("EZTV API Error: Page must be between 1 and 100.");
  }

  const url = new URL(baseUrl);

  if (limit) {
    url.searchParams.append("limit", limit.toString());
  }
  if (page) {
    url.searchParams.append("page", page.toString());
  }
  if (imdb_id) {
    // Standardize IMDB ID by removing 'tt' prefix if user included it
    const cleanId = imdb_id.toString().replace(/\D/g, "");
    url.searchParams.append("imdb_id", cleanId);
  }

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(
      `EZTV API Request Failed: ${response.status} ${response.statusText}`
    );
  }

  const data = (await response.json()) as EZTVResponse;
  return data;
};