import { defineConfig } from "tsdown";

export default defineConfig({
	entry: "./src/index.ts",
	format: "esm",
	outDir: "./dist",
	clean: true,
	treeshake: true,
	minify: true,
	// Bundle everything except native addons and packages with dynamic require()
	// that bundlers cannot statically inline. These must be installed in the final image.
	noExternal: [/.*/],
	external: ["sharp", "discord-webhook-node"],
});
