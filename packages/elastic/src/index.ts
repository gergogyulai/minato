import { Client } from "@elastic/elasticsearch";

export const elasticClient = new Client({
  node: process.env.ELASTICSEARCH_NODE || "http://localhost:9200",
  auth: {
    apiKey: process.env.ELASTICSEARCH_API_KEY || "",
  },
});
