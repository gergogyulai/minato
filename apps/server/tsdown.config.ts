import { defineConfig } from "tsdown";

export default defineConfig({
  entry: "./src/index.ts",
  format: "esm",
  outDir: "./dist",
  clean: true,
  treeshake: true,
  minify: true,
  noExternal: [/.*/],
  // better-auth uses dynamic require() for its plugin system at runtime —
  // use regex to cover all subpaths (better-auth/plugins, better-auth/client, etc.)
  external: [/^better-auth/, /^@better-auth\//],
});
