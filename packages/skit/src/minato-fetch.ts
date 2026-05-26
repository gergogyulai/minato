import type { FlareSolverr } from "@project-minato/api-clients";

type FlareSolverrCtx = { flaresolverr: FlareSolverr };

export async function ffetch(
  ctx: FlareSolverrCtx,
  url: string | URL,
  init?: RequestInit,
): Promise<Response> {
  const urlStr = url.toString();
  const method = (init?.method ?? "GET").toUpperCase();

  let result: Awaited<ReturnType<FlareSolverr["get"]>>;

  if (method === "POST") {
    result = await ctx.flaresolverr.post({
      url: urlStr,
      postData: init?.body != null ? String(init.body) : "",
    });
  } else if (method === "GET") {
    result = await ctx.flaresolverr.get({ url: urlStr });
  } else {
    throw new Error(
      `ffetch: unsupported method "${method}" — FlareSolverr only supports GET and POST`,
    );
  }

  if (result.status !== "ok" || !result.solution) {
    throw new Error(`ffetch: FlareSolverr error — ${result.message}`);
  }

  const { solution } = result;
  return new Response(solution.response, {
    status: solution.status,
    headers: solution.headers,
  });
}

export const flareFetch = ffetch;
