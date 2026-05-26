import type { IngestClient, TorrentInput, IngestResult } from "./types";

const FLUSH_INTERVAL_MS = 3_000;
const FLUSH_BATCH_SIZE = 50;
const REQUEST_TIMEOUT_MS = 30_000;

export function createIngestClient(
  apiUrl: string,
  apiKey: string,
): IngestClient {
  const buffer: TorrentInput[] = [];
  let flushTimer: ReturnType<typeof setTimeout> | null = null;

  function scheduleFlush() {
    if (flushTimer) return;
    flushTimer = setTimeout(() => {
      flushTimer = null;
      flush().catch(() => {});
    }, FLUSH_INTERVAL_MS);
  }

  async function sendBatch(batch: TorrentInput[]): Promise<IngestResult> {
    const body = batch.map((t) => ({
      infoHash: t.infoHash,
      title: t.title,
      size: t.size,
      seeders: t.seeders ?? 0,
      leechers: t.leechers ?? 0,
      magnet: t.magnet,
      category: t.category,
      publishedAt: t.publishedAt,
      files: t.files,
      source: t.source,
    }));

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const res = await fetch(`${apiUrl}/api/v1/torrents/ingest`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Minato-Key": apiKey,
          // Ingest endpoint also checks X-Minato-Scraper for backwards compat
          "X-Minato-Scraper": body[0]?.source.name ?? "skit",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (res.status >= 500) {
        // Single retry on 5xx
        const retry = await fetch(`${apiUrl}/api/v1/torrents/ingest`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Minato-Key": apiKey,
            "X-Minato-Scraper": body[0]?.source.name ?? "skit",
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
        return (await retry.json()) as IngestResult;
      }

      return (await res.json()) as IngestResult;
    } finally {
      clearTimeout(timeout);
    }
  }

  async function flush(): Promise<void> {
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }

    while (buffer.length > 0) {
      const batch = buffer.splice(0, FLUSH_BATCH_SIZE);
      // Never throw — individual rejections are counted but don't crash
      await sendBatch(batch).catch(() => {});
    }
  }

  return {
    add(torrent: TorrentInput) {
      buffer.push(torrent);
      if (buffer.length >= FLUSH_BATCH_SIZE) {
        flush().catch(() => {});
      } else {
        scheduleFlush();
      }
    },

    flush,
  };
}
