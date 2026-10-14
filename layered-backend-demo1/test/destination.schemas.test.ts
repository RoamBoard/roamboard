import assert from "node:assert/strict";
import test from "node:test";

import { destinationContextSchema, destinationSearchSchema } from "../src/features/destinations/destination.schemas.js";

test("accepts a bounded destination search query", () => {
    const result = destinationSearchSchema.safeParse({ query: { q: "Kyoto", limit: "6" } });
    assert.equal(result.success, true);
    if (result.success) assert.equal(result.data.query.limit, 6);
});

test("rejects invalid coordinates and unknown context fields", () => {
    const result = destinationContextSchema.safeParse({
        query: {
            id: "mapbox.place.1",
            name: "Kyoto",
            address: "Kyoto, Japan",
            latitude: 120,
            longitude: 135.76,
            placeType: "place",
            unexpected: true
        }
    });
    assert.equal(result.success, false);
});
