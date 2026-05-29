// In-process command pub/sub keyed by scraperId. Each connected SSE listener
// (the scraper's own command subscriber) gets pushes here when an admin issues
// a command. Single-server only — multi-instance deployments would need to
// swap this for Redis pub/sub.

export type CommandEvent = {
  id: string;
  command: "pause" | "stop" | "resume";
};

export type CommandListener = (evt: CommandEvent) => void;

const channels = new Map<string, Set<CommandListener>>();

export function subscribe(
  scraperId: string,
  listener: CommandListener,
): () => void {
  let set = channels.get(scraperId);
  if (!set) {
    set = new Set();
    channels.set(scraperId, set);
  }
  set.add(listener);

  return () => {
    const current = channels.get(scraperId);
    if (!current) return;
    current.delete(listener);
    if (current.size === 0) channels.delete(scraperId);
  };
}

export function publishCommand(scraperId: string, evt: CommandEvent): void {
  const listeners = channels.get(scraperId);
  if (!listeners) return;
  for (const listener of listeners) {
    try {
      listener(evt);
    } catch (err) {
      console.error(`[scraper:pubsub] listener for ${scraperId} threw:`, err);
    }
  }
}
