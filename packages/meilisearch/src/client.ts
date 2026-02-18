import { MeiliSearch } from "meilisearch";

export const meiliClient = new MeiliSearch({
  host: process.env.MEILISEARCH_HOST || "http://localhost:7700",
  apiKey:
    process.env.MEILISEARCH_MASTER_KEY || "masterKey_change_me_in_production",
});
