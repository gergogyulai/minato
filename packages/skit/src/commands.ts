const RECONNECT_DELAY_MS = 5_000;

// Uses fetch + ReadableStream instead of EventSource to support
// custom request headers (EventSource constructor doesn't accept them).
export function createCommandSignal(
  apiUrl: string,
  apiKey: string,
  scraperId: string,
): AbortSignal {
  const controller = new AbortController();

  async function connect(lastEventId?: string) {
    if (controller.signal.aborted) return;

    try {
      const headers: Record<string, string> = {
        Accept: "text/event-stream",
        "Cache-Control": "no-cache",
        "X-Minato-Key": apiKey,
      };
      if (lastEventId) headers["Last-Event-ID"] = lastEventId;

      const res = await fetch(
        `${apiUrl}/api/v1/scraper/commands/${scraperId}`,
        { headers, signal: controller.signal },
      );

      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let seenEventId: string | undefined;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";

        let eventId: string | undefined;
        let eventType: string | undefined;
        let data: string | undefined;

        for (const line of lines) {
          if (line.startsWith("id: ")) {
            eventId = line.slice(4);
          } else if (line.startsWith("event: ")) {
            eventType = line.slice(7);
          } else if (line.startsWith("data: ")) {
            data = line.slice(6);
          } else if (line === "") {
            // Dispatch event
            if (eventId) seenEventId = eventId;
            if (eventType === "command" && data) {
              const { command } = JSON.parse(data) as { command: string };
              if (command === "pause" || command === "stop") {
                controller.abort();
                reader.cancel();
                return;
              }
            }
            eventId = undefined;
            eventType = undefined;
            data = undefined;
          }
        }
      }

      // Stream ended cleanly — reconnect
      reconnect(seenEventId);
    } catch {
      reconnect(undefined);
    }
  }

  function reconnect(lastEventId?: string) {
    if (controller.signal.aborted) return;
    setTimeout(() => connect(lastEventId), RECONNECT_DELAY_MS);
  }

  connect();
  return controller.signal;
}
