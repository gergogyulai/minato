import type { StatusReporter, ScraperStatus } from "./types";

export function createStatusReporter(
  apiUrl: string,
  apiKey: string,
): StatusReporter {
  return {
    update(status: ScraperStatus) {
      // Fire-and-forget — failures are silently swallowed
      fetch(`${apiUrl}/api/v1/scraper/status`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Minato-Key": apiKey,
        },
        body: JSON.stringify(status),
      }).catch(() => {});
    },
  };
}
