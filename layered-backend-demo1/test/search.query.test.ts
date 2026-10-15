import assert from "node:assert/strict";
import test from "node:test";
import { rankDocuments, suggestDocuments } from "../src/features/search/search.ranking.js";

const base = {
    description: "",
    city: "",
    country: "Sweden",
    tags: [] as string[],
    categories: ["culture"],
    isPublic: true,
    entityType: "destination"
};

test("search tolerates misspellings and excludes private and unrelated records", () => {
    const result = rankDocuments(
        [
            { ...base, id: "public", title: "Stockholm" },
            { ...base, id: "private", title: "Stockholm secret", isPublic: false },
            { ...base, id: "other", title: "Tokyo" }
        ],
        { q: "stokholm", page: 1, limit: 10 }
    );
    assert.deepEqual(
        result.hits.map((hit) => hit.document.id),
        ["public"]
    );
    assert.equal(result.total, 1);
});

test("title matches outrank description matches and pagination retains total", () => {
    const documents = [
        { ...base, id: "description", title: "Weekend", description: "Stockholm" },
        { ...base, id: "title", title: "Stockholm" }
    ];
    const first = rankDocuments(documents, { q: "stockholm", page: 1, limit: 1 });
    const second = rankDocuments(documents, { q: "stockholm", page: 2, limit: 1 });
    assert.equal(first.hits[0]?.document.id, "title");
    assert.equal(second.hits[0]?.document.id, "description");
    assert.equal(first.total, 2);
    assert.equal(second.total, 2);
    assert.equal(second.page, 2);
    assert.equal(second.limit, 1);
});

test("country, category and entity filters apply before pagination", () => {
    const documents = [
        { ...base, id: "match", title: "Stockholm", entityType: "place" },
        { ...base, id: "country", title: "Stockholm", entityType: "place", country: "Japan" },
        { ...base, id: "category", title: "Stockholm", entityType: "place", categories: ["food"] },
        { ...base, id: "entity", title: "Stockholm" }
    ];
    const result = rankDocuments(documents, {
        q: "stockholm",
        country: "sweden",
        category: "culture",
        entityType: "place",
        page: 1,
        limit: 1
    });
    assert.deepEqual(
        result.hits.map((hit) => hit.document.id),
        ["match"]
    );
    assert.equal(result.total, 1);
});

test("suggestions use public title prefixes, deduplicate and honor limit", () => {
    const documents = [
        { ...base, id: "1", title: "Stockholm" },
        { ...base, id: "2", title: "Stockholm" },
        { ...base, id: "3", title: "Stockholm secret", isPublic: false },
        { ...base, id: "4", title: "Tokyo", description: "Stockholm" },
        { ...base, id: "5", title: "Stockholm weekend" }
    ];
    assert.deepEqual(new Set(suggestDocuments(documents, "STO", 10)), new Set(["Stockholm", "Stockholm weekend"]));
    assert.equal(suggestDocuments(documents, "sto", 1).length, 1);
    assert.deepEqual(suggestDocuments(documents, "unknown", 10), []);
});
