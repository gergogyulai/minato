import { defineConfig } from "tsdown";

export default defineConfig({
  entry: "./src/index.ts",
  format: "esm",
  outDir: "./dist",
  clean: true,
  treeshake: true,
  minify: true,
  // Bundle everything except sharp (native addon — requires prebuilt .node binaries
  // that cannot be inlined by tsdown and must be installed in the final image).
  noExternal: [/.*/],
  external: ["sharp"],
});
