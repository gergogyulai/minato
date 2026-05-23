import { env } from "@project-minato/env/web";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: import.meta.env.PROD ? window.location.origin : (env.VITE_SERVER_URL ?? "http://localhost:3000"),
  basePath: "/api/v1/auth",
});
