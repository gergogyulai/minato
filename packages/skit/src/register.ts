import type { ScraperManifest } from "./types";

type RegisterResult = {
  config: Record<string, unknown>;
  flareSolverrUrl: string;
};

export async function register(
  apiUrl: string,
  apiKey: string,
  manifest: ScraperManifest,
): Promise<RegisterResult> {
  const res = await fetch(`${apiUrl}/api/v1/scraper/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Minato-Key": apiKey,
    },
    body: JSON.stringify({
      version: manifest.version,
      pid: process.pid,
      capabilities: manifest.capabilities,
    }),
  });

  if (!res.ok) {
    throw new Error(`Scraper registration failed: ${res.status} ${await res.text()}`);
  }

  const body = (await res.json()) as { config: Record<string, unknown>; flareSolverrUrl: string };
  return { config: body.config, flareSolverrUrl: body.flareSolverrUrl };
}
