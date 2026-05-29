import path from "node:path";

// In dev, this file is at packages/env/src/ — three levels up is the project root.
const configRoot =
	process.env.NODE_ENV === "production"
		? "/config"
		: path.resolve(import.meta.dir, "../../../config");

export const mediaRoot = path.join(configRoot, "media");
export const communityScrapersDir = path.join(configRoot, "scrapers");

// Internal scrapers are baked into the production image; in dev the directory
// simply won't exist and the supervisor discovers nothing there.
export const internalScrapersDir =
	process.env.NODE_ENV === "production"
		? "/app/apps/scraper"
		: path.resolve(import.meta.dir, "../../../apps/scraper");
