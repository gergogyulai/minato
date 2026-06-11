import { defineConfig } from "tsdown";

export default defineConfig({
	entry: "./src/index.ts",
	format: "esm",
	outDir: "./dist",
	clean: true,
	treeshake: true,
	minify: true,
	// Bundle workspace packages (our own code), leave npm dependencies external
	// so they can be simply installed in the Docker image with bun install.
	noExternal: [/^@project-minato\//],
});
