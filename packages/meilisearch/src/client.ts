import { env } from "@project-minato/env/shared";
import { MeiliSearch } from "meilisearch";

export const meiliClient = new MeiliSearch({
  host: env.MEILISEARCH_HOST,
  apiKey:
    env.MEILISEARCH_MASTER_KEY,
});
