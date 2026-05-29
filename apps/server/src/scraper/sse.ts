import { streamSSE } from "hono/streaming";
import type { Context } from "hono";
import {
  db,
  scraperCommands,
  scrapers,
  user,
  eq,
  and,
  gt,
  asc,
} from "@project-minato/db";
import { auth } from "@project-minato/auth";
import { getConfig } from "@project-minato/config";
import {
  subscribe,
  type CommandEvent,
} from "@/scraper/commands-pubsub";

const HEARTBEAT_MS = 30_000;

async function verifyScraperKey(
  req: Request,
  expectedScraperId: string,
): Promise<boolean> {
  const rawKey = req.headers.get("X-Minato-Key");
  if (!rawKey) return false;
  const result = await auth.api.verifyApiKey({ body: { key: rawKey } });
  if (!result.valid || !result.key) return false;
  const metadata = result.key.metadata as { scraperId?: string } | null;
  return metadata?.scraperId === expectedScraperId;
}

export async function handleCommandsSse(
  c: Context,
  scraperId: string,
): Promise<Response> {
  if (!(await verifyScraperKey(c.req.raw, scraperId))) {
    return c.text("Unauthorized", 401);
  }

  // Last-Event-ID lets the SDK ask us to replay everything since that command.
  const lastEventId = c.req.header("Last-Event-ID");
  let replayFromDate: Date | null = null;
  if (lastEventId) {
    const [row] = await db
      .select({ createdAt: scraperCommands.createdAt })
      .from(scraperCommands)
      .where(eq(scraperCommands.id, lastEventId))
      .limit(1);
    if (row) replayFromDate = row.createdAt;
  }

  return streamSSE(c, async (stream) => {
    const replay = replayFromDate
      ? await db
          .select({
            id: scraperCommands.id,
            command: scraperCommands.command,
            createdAt: scraperCommands.createdAt,
          })
          .from(scraperCommands)
          .where(
            and(
              eq(scraperCommands.scraperId, scraperId),
              gt(scraperCommands.createdAt, replayFromDate),
            ),
          )
          .orderBy(asc(scraperCommands.createdAt))
      : [];

    for (const cmd of replay) {
      await stream.writeSSE({
        id: cmd.id,
        event: "command",
        data: JSON.stringify({ id: cmd.id, command: cmd.command }),
      });
      await db
        .update(scraperCommands)
        .set({ status: "delivered", deliveredAt: new Date() })
        .where(eq(scraperCommands.id, cmd.id));
    }

    const queue: CommandEvent[] = [];
    let resolveWait: (() => void) | null = null;

    const unsubscribe = subscribe(scraperId, (evt) => {
      queue.push(evt);
      const resolve = resolveWait;
      if (resolve) {
        resolveWait = null;
        resolve();
      }
    });

    const heartbeat = setInterval(() => {
      stream.writeln(":heartbeat").catch(() => {});
    }, HEARTBEAT_MS);

    stream.onAbort(() => {
      unsubscribe();
      clearInterval(heartbeat);
      const resolve = resolveWait;
      if (resolve) {
        resolveWait = null;
        resolve();
      }
    });

    try {
      while (!stream.aborted) {
        if (queue.length === 0) {
          await new Promise<void>((resolve) => {
            resolveWait = resolve;
          });
          continue;
        }
        const evt = queue.shift();
        if (!evt) continue;

        await stream.writeSSE({
          id: evt.id,
          event: "command",
          data: JSON.stringify({ id: evt.id, command: evt.command }),
        });
        await db
          .update(scraperCommands)
          .set({ status: "delivered", deliveredAt: new Date() })
          .where(eq(scraperCommands.id, evt.id));
      }
    } finally {
      unsubscribe();
      clearInterval(heartbeat);
    }
  });
}

type EnsureKeyBody = {
  scraperId: string;
  manifest: {
    id: string;
    name: string;
    title: string;
    version: string;
    author?: string;
    entry: string;
    capabilities: string[];
    defaultConfig?: Record<string, unknown>;
  };
  source:
    | { kind: "first_party" }
    | { kind: "git"; url: string; ref?: string }
    | { kind: "registry"; slug: string; url: string };
};

export async function handleEnsureKey(c: Context): Promise<Response> {
  const secret = c.req.header("X-Supervisor-Secret");
  const expected = getConfig().internalSupervisorSecret;
  if (!expected || !secret || secret !== expected) {
    return c.text("Unauthorized", 401);
  }

  let body: EnsureKeyBody;
  try {
    body = (await c.req.json()) as EnsureKeyBody;
  } catch {
    return c.text("Invalid JSON", 400);
  }

  if (!body.scraperId || !body.manifest?.id || !body.source?.kind) {
    return c.text("Missing required fields", 400);
  }

  const [admin] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.role, "admin"))
    .limit(1);
  if (!admin) {
    return c.text("No admin user found — complete setup first", 503);
  }

  // Existing record → revoke the old key (best-effort) and issue a new one.
  // The supervisor calls ensure-key once per startup; better-auth doesn't
  // expose stored raw keys, so re-issuing is the only path back to a usable
  // key when supervisor state is lost.
  const [existing] = await db
    .select({ apiKeyId: scrapers.apiKeyId })
    .from(scrapers)
    .where(eq(scrapers.id, body.scraperId))
    .limit(1);

  if (existing) {
    try {
      await auth.api.deleteApiKey({
        body: { keyId: existing.apiKeyId },
        headers: new Headers(),
      });
    } catch {
      // Key may already be gone — that's fine, proceed with re-issue.
    }

    const created = await auth.api.createApiKey({
      body: {
        name: `scraper:${body.scraperId}`,
        userId: admin.id,
        metadata: { type: "scraper", scraperId: body.scraperId },
      },
    });

    await db
      .update(scrapers)
      .set({
        name: body.manifest.title,
        apiKeyId: created.id,
        manifest: body.manifest,
        installedVersion: body.manifest.version,
        source: body.source,
        updatedAt: new Date(),
      })
      .where(eq(scrapers.id, body.scraperId));

    return c.json({ apiKey: created.key });
  }

  const created = await auth.api.createApiKey({
    body: {
      name: `scraper:${body.scraperId}`,
      userId: admin.id,
      metadata: { type: "scraper", scraperId: body.scraperId },
    },
  });

  await db.insert(scrapers).values({
    id: body.scraperId,
    name: body.manifest.title,
    apiKeyId: created.id,
    source: body.source,
    installedVersion: body.manifest.version,
    manifest: body.manifest,
    state: "ready",
    enabled: true,
  });

  return c.json({ apiKey: created.key });
}
