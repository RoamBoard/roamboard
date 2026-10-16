import assert from "node:assert/strict";
import test from "node:test";
import { sampleSearchDocuments } from "../src/features/search/search.documents.js";
import { createSearchService } from "../src/features/search/search.service.js";

test("search reads current repository records without a separate search service", async () => {
    let documents = structuredClone(sampleSearchDocuments);
    const service = createSearchService({
        async findAll() {
            return structuredClone(documents);
        }
    });
    const typoResult = await service.search({ query: "stokholm", page: 1, limit: 10 });
    assert.ok(typoResult.hits.some((hit) => hit.document.title === "Stockholm"));
    assert.ok((await service.suggestions("sto", 5)).includes("Stockholm"));
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
    documents = documents.map((document) => ({ ...document, isPublic: false }));
    assert.equal((await service.search({ query: "stockholm", page: 1, limit: 10 })).total, 0);
    assert.deepEqual(await service.suggestions("sto", 5), []);
    documents = [];
    assert.equal((await service.search({ query: "stockholm", page: 1, limit: 10 })).total, 0);
});
