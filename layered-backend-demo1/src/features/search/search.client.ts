import { Client } from "@elastic/elasticsearch";

import { env } from "../../config/env.js";

export function createSearchClient(): Client {
  if (env.ELASTIC_CLOUD_ID && env.ELASTIC_API_KEY) {
    return new Client({
      cloud: { id: env.ELASTIC_CLOUD_ID },
      auth: { apiKey: env.ELASTIC_API_KEY },
    });
  }

  return new Client({ node: env.ELASTICSEARCH_NODE });
}