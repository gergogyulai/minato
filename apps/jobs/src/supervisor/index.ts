import {
  internalScrapersDir,
  communityScrapersDir,
} from "@project-minato/env/paths";
import { start, stopAll } from "./supervisor";

export async function startSupervisor(): Promise<void> {
  await start(internalScrapersDir, communityScrapersDir);
}

export async function stopAllScrapers(): Promise<void> {
  await stopAll();
}
