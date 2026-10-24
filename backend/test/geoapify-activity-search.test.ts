import assert from "node:assert/strict";
import test from "node:test";
import { searchGeoapify } from "../src/features/providers/provider.geoapify.js";

test("nearby category and brand searches use one Geoapify Places request and retain permanent named POIs", async (context) => {
    const requests: URL[] = [];
    context.mock.method(globalThis, "fetch", async (input: URL | string) => {
        requests.push(new URL(input));
        return Response.json({
            features: [
                {
                    properties: {
                        place_id: "saved-cafe",
                        name: "Starbucks",
                        lat: 59.33,
                        lon: 18.06,
                        categories: ["catering.cafe"],
                        city: "Stockholm",
                        country: "Sweden",
                        country_code: "se"
                    }
                }
            ]
        });
    });
    for (const query of ["cafes near me", "cafe: Starbucks", "coffee nearby"]) {
        const before = requests.length;
        const results = await searchGeoapify(query, 8, "test-key", undefined, undefined, {
            latitude: 59.3,
            longitude: 18.1
        });
        assert.equal(requests.length, before + 1, "Typing a query must not fan out provider requests");
        const url = requests.at(-1)!;
        assert.equal(url.pathname, "/v2/places");
        assert.equal(url.searchParams.get("categories"), "catering.cafe");
        assert.equal(url.searchParams.get("name"), query === "cafe: Starbucks" ? "Starbucks" : null);
        assert.equal(url.searchParams.get("bias"), "proximity:18.1,59.3");
        assert.equal(url.searchParams.get("limit"), "8");
        assert.equal(results[0]?.id, "geoapify:saved-cafe");
        assert.equal(results[0]?.name, "Starbucks");
        assert.equal(results[0]?.placeType, "cafe");
        assert.equal(results[0]?.countryCode, "SWE");
    }
});

test("named locations, city selection and searches without a location retain geocoding and explicit geography", async (context) => {
    const requests: URL[] = [];
    context.mock.method(globalThis, "fetch", async (input: URL | string) => {
        requests.push(new URL(input));
        return Response.json({
            features: [
                {
                    properties: {
                        place_id: "stockholm",
                        name: "Stockholm",
                        lat: 59.33,
                        lon: 18.06,
                        result_type: "city",
                        category: "administrative",
                        country: "Sweden",
                        country_code: "se"
                    }
                }
            ]
        });
    });
    const proximity = { latitude: 59.3, longitude: 18.1 };
    for (const query of ["Starbucks", "Stockholm", "Park Avenue", "Museum of Modern Art"]) {
        const results = await searchGeoapify(query, 5, "test-key", undefined, undefined, proximity, true);
        assert.equal(requests.at(-1)?.pathname, "/v1/geocode/search");
        assert.equal(requests.at(-1)?.searchParams.get("type"), "locality");
        assert.equal(requests.at(-1)?.searchParams.get("text"), query);
        assert.equal(results[0]?.placeType, "place", "Administrative results must not become activity POIs");
    }
    for (const query of ["Starbucks", "Park Avenue", "Museum of Modern Art"]) {
        await searchGeoapify(query, 5, "test-key", undefined, undefined, proximity);
        assert.equal(requests.at(-1)?.pathname, "/v1/geocode/search");
        assert.equal(requests.at(-1)?.searchParams.get("text"), query);
    }
    assert.equal(requests.at(-1)?.pathname, "/v1/geocode/search", "Unrecognized names remain a free text lookup");
    await searchGeoapify("cafes near me", 5, "test-key");
    assert.equal(requests.at(-1)?.pathname, "/v1/geocode/search", "No proximity must not invent a nearby Places scope");
    assert.equal(
        requests.at(-1)?.searchParams.get("bias"),
        "countrycode:none",
        "Server IP must not choose the user's geography"
    );
});
