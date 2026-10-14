import assert from "node:assert/strict";
import test from "node:test";

import { createSearchClient } from "../src/features/search/search.client.js";
import { SEARCH_INDEX } from "../src/features/search/search.index.js";
import { sampleSearchDocuments } from "../src/features/search/search.documents.js";
import { createSearchService } from "../src/features/search/search.service.js";
import { createSearchSourceRepository } from "../src/features/search/search.repository.js";

const runIntegration = process.env.RUN_ELASTICSEARCH_INTEGRATION === "1";

test("reindexes and searches the seeded travel records", { skip: !runIntegration }, async () => {
    const client = createSearchClient();
    const service = createSearchService(client, createSearchSourceRepository(sampleSearchDocuments));

    await client.indices.delete({ index: SEARCH_INDEX }).catch(() => undefined);
    assert.equal(await service.reindex(), sampleSearchDocuments.length);

    const typoResult = await service.search({
        query: "stokholm",
        page: 1,
        limit: 10
    });
    assert.ok(typoResult.hits.some((hit) => hit.document.title === "Stockholm"));

    const suggestions = await service.suggestions("sto", 5);
    assert.ok(suggestions.includes("Stockholm"));

    const filtered = await service.search({
        query: "stockholm",
        entityType: "place",
        country: "sweden",
        category: "culture",
        page: 1,
        limit: 10
    });
    assert.deepEqual(
        filtered.hits.map((hit) => hit.document.id),
        ["place-vasa-museum"]
    );

    await client.close();
});
