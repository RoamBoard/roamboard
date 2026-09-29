import { createSearchClient } from "./search.client.js";
import { createSearchModule } from "./search.module.js";

const command = process.argv[2] ?? "reindex";
const searchModule = createSearchModule({ client: createSearchClient() });

if (command === "setup") {
  await searchModule.service.ensureIndex();
  console.log("Elasticsearch index ready: roamboard-search-v1");
} else if (command === "reindex" || command === "seed") {
  const count = await searchModule.service.reindex();
  console.log(`Indexed ${count} search documents into roamboard-search-v1`);
} else {
  console.error(`Unknown search command: ${command}`);
  process.exitCode = 1;
}