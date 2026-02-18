export interface FlareSolverrResponse<T> {
  status: "ok" | "error";
  message: string;
  startTimestamp: number;
  endTimestamp: number;
  version: string;
  solution?: T;
}

export interface Cookie {
  name: string;
  value: string;
  domain?: string;
  path?: string;
  expires?: number;
  size?: number;
  httpOnly?: boolean;
  secure?: boolean;
  session?: boolean;
  sameSite?: string;
}

export interface Solution {
  url: string;
  status: number;
  headers: Record<string, string>;
  response: string;
  cookies: Cookie[];
  userAgent: string;
  turnstile_token?: string;
  screenshot?: string;
}

export interface ProxyConfig {
  url: string;
  username?: string;
  password?: string;
}

export interface RequestOptions {
  url: string;
  session?: string;
  session_ttl_minutes?: number;
  maxTimeout?: number;
  cookies?: { name: string; value: string }[];
  returnOnlyCookies?: boolean;
  returnScreenshot?: boolean;
  proxy?: ProxyConfig;
  waitInSeconds?: number;
  disableMedia?: boolean;
}


export class FlareSolverr {
  private baseURL: string;

  constructor(baseURL: string = "http://localhost:8191") {
    let url = baseURL.endsWith("/") ? baseURL.slice(0, -1) : baseURL;
    if (!url.endsWith("/v1")) {
      url += "/v1";
    }
    this.baseURL = url;
  }

  /**
   * Internal helper to handle the fetch logic
   */
  private async sendCommand<T>(body: object): Promise<T> {
    const response = await fetch(this.baseURL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`FlareSolverr HTTP Error: ${response.status} ${response.statusText}`);
    }

    return response.json() as Promise<T>;
  }

  /**
   * Perform a GET request through FlareSolverr
   */
  async get(options: RequestOptions): Promise<FlareSolverrResponse<Solution>> {
    return this.sendCommand({
      cmd: "request.get",
      ...options,
    });
  }

  /**
   * Perform a POST request through FlareSolverr
   */
  async post(
    options: RequestOptions & { postData: string }
  ): Promise<FlareSolverrResponse<Solution>> {
    return this.sendCommand({
      cmd: "request.post",
      ...options,
    });
  }

  /**
   * Create a new persistent session
   */
  async createSession(
    session?: string,
    proxy?: ProxyConfig
  ): Promise<FlareSolverrResponse<{ session: string }>> {
    return this.sendCommand({
      cmd: "sessions.create",
      session,
      proxy,
    });
  }

  /**
   * List all active sessions
   */
  async listSessions(): Promise<{ sessions: string[] }> {
    return this.sendCommand({ cmd: "sessions.list" });
  }

  /**
   * Destroy a persistent session
   */
  async destroySession(session: string): Promise<FlareSolverrResponse<null>> {
    return this.sendCommand({
      cmd: "sessions.destroy",
      session,
    });
  }
}