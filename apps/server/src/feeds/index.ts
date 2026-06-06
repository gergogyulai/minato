import { Hono } from "hono";
import { handleRss } from "./rss";
import { handleTorznab } from "./torznab";

export const feeds = new Hono();

feeds.get("/torznab", handleTorznab);
feeds.get("/rss", handleRss);
