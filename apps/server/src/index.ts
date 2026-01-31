import { env } from "@project-minato/env/server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import authRoutes from "./routes/auth";
import torrents from "./routes/torrents";
import torznab from "./routes/torznab";

const app = new Hono().basePath("/api/v1");

app.use(logger());
app.use(
  "/*",
  cors({
    origin: env.CORS_ORIGIN,
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  }),
);

app.route("/auth", authRoutes);
app.route("/torrents", torrents);
app.route("/torznab", torznab);

app.get("/ping", (c) => {
  return c.text("pong");
});

export default app;
