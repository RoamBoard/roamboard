import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import request from "supertest";
import { createApp } from "../src/app.js";
import type { QuotaService } from "../src/features/quotas/quota.service.js";

function configureToken(context: TestContext) {
    const original = process.env.MAPBOX_ACCESS_TOKEN;
    process.env.MAPBOX_ACCESS_TOKEN = "sk.destination-test-only";
    context.after(() => {
        if (original === undefined) delete process.env.MAPBOX_ACCESS_TOKEN;
        else process.env.MAPBOX_ACCESS_TOKEN = original;
    });
}

function appWithQuota(policies: string[] = []) {
    const quotaService: QuotaService = {
        async reserve(id) {
            policies.push(id);
        },
        async run(id, operation) {
            policies.push(id);
            return operation();
        }
    };
    return createApp({ quotaService });
}

function city(id: string, name: string, country: string, countryCode: string, featureType = "place") {
    return {
        id,
        geometry: { coordinates: [-9.14, 38.72] },
        properties: {
            name,
            feature_type: featureType,
            place_formatted: `${country}`,
            context: { country: { name: country, country_code: countryCode } }
        }
    };
}

test("destination autocomplete forwards the query to unrestricted global city geocoding", async (context) => {
    configureToken(context);
    const policies: string[] = [];
    const urls: URL[] = [];
    context.mock.method(globalThis, "fetch", async (input: URL | string | Request) => {
        const url = new URL(String(input));
        urls.push(url);
        return Response.json({
            features: [
                city("lisbon-poi", "Lisbon", "Portugal", "PT", "poi"),
                city("lisbon-neighborhood", "Lisbon", "Portugal", "PT", "neighborhood"),
                city("lisbon-address", "Lisbon", "Portugal", "PT", "address"),
                city("lisbon-portugal", "Lisbon", "Portugal", "PT"),
                city("lisbon-us", "Lisbon", "United States", "US")
            ]
        });
    });

    const response = await request(appWithQuota(policies))
        .get("/api/v1/destinations/search")
        .query({ q: "Lisb", limit: 1 });
    assert.equal(response.status, 200);
    assert.deepEqual(response.body.data, [
        {
            id: "lisbon-portugal",
            name: "Lisbon",
            address: "Portugal",
            latitude: 38.72,
            longitude: -9.14,
            placeType: "place",
            context: ["Portugal"],
            country: "Portugal",
            countryCode: "PRT",
            city: "Lisbon"
        }
    ]);
    assert.equal(urls.length, 1);
    assert.equal(urls[0]?.hostname, "api.mapbox.com");
    assert.equal(urls[0]?.pathname, "/search/geocode/v6/forward");
    assert.equal(urls[0]?.searchParams.get("types"), "place");
    assert.equal(urls[0]?.searchParams.get("autocomplete"), "true");
    assert.equal(urls[0]?.searchParams.get("q"), "Lisb");
    assert.equal(urls[0]?.searchParams.has("country"), false);
    assert.equal(urls[0]?.searchParams.has("proximity"), false);
    assert.equal(urls[0]?.searchParams.has("bbox"), false);
    assert.equal(urls[0]?.searchParams.has("permanent"), false);
    assert.deepEqual(policies, ["mapbox.geocoding"]);
});

test("destination suggestions preserve provider ranking rather than applying a hardcoded country preference", async (context) => {
    configureToken(context);
    context.mock.method(globalThis, "fetch", async () =>
        Response.json({
            features: [
                city("paris-texas", "Paris", "United States", "US"),
                city("paris-france", "Paris", "France", "FR")
            ]
        })
    );
    const response = await request(appWithQuota()).get("/api/v1/destinations/search").query({ q: "Paris", limit: 2 });
    assert.equal(response.status, 200);
    assert.deepEqual(
        response.body.data.map((result: { id: string }) => result.id),
        ["paris-texas"]
    );
    assert.equal(response.body.data[0].countryCode, "USA");
});

test("Stockholm suggestions omit an airport mislabeled as a city and lower-ranked namesakes", async (context) => {
    configureToken(context);
    context.mock.method(globalThis, "fetch", async () =>
        Response.json({
            features: [
                city("stockholm-sweden", "Stockholm", "Sweden", "SE"),
                city("arlanda", "Stockholm Arlanda Airport", "Sweden", "SE"),
                city("stockholm-wisconsin", "Stockholm", "United States", "US"),
                city("stockholm-canada", "Stockholm", "Canada", "CA")
            ]
        })
    );
    const response = await request(appWithQuota()).get("/api/v1/destinations/search").query({ q: "Stockholm" });
    assert.equal(response.status, 200);
    assert.deepEqual(
        response.body.data.map((result: { id: string }) => result.id),
        ["stockholm-sweden"]
    );
    assert.equal(response.body.data[0].countryCode, "SWE");
});

test("a qualified city query keeps the requested namesake first and allows distinct niche destinations", async (context) => {
    configureToken(context);
    context.mock.method(globalThis, "fetch", async (input: URL | string | Request) => {
        const url = new URL(String(input));
        assert.equal(url.searchParams.get("q"), "Stockholm Wisconsin");
        for (const filter of ["country", "bbox", "proximity"]) assert.equal(url.searchParams.has(filter), false);
        return Response.json({
            features: [
                city("stockholm-wisconsin", "Stockholm", "United States", "US"),
                city("stockholm-sweden", "Stockholm", "Sweden", "SE"),
                city("mineral-point", "Mineral Point", "United States", "US")
            ]
        });
    });
    const response = await request(appWithQuota())
        .get("/api/v1/destinations/search")
        .query({ q: "Stockholm Wisconsin", limit: 2 });
    assert.equal(response.status, 200);
    assert.deepEqual(
        response.body.data.map((result: { id: string }) => result.id),
        ["stockholm-wisconsin", "mineral-point"]
    );
    assert.equal(response.body.data[0].countryCode, "USA");
});

test("accent, case, punctuation and Unicode compatibility variants share one suggestion before applying the limit", async (context) => {
    configureToken(context);
    context.mock.method(globalThis, "fetch", async () =>
        Response.json({
            features: [
                city("sao-tome", "São Tomé", "São Tomé and Príncipe", "ST"),
                city("sao-tome-other", "SAO-TOME", "United States", "US"),
                city("sao-tome-wide", "Ｓａｏ　Ｔｏｍｅ", "Canada", "CA"),
                city("santo-antonio", "Santo António", "São Tomé and Príncipe", "ST")
            ]
        })
    );
    const response = await request(appWithQuota()).get("/api/v1/destinations/search").query({ q: "Sao", limit: 2 });
    assert.equal(response.status, 200);
    assert.deepEqual(
        response.body.data.map((result: { id: string }) => result.id),
        ["sao-tome", "santo-antonio"]
    );
    assert.equal(response.body.data[0].name, "São Tomé");
});

test("transport facility names mislabeled as cities are filtered without rejecting unrelated city names", async (context) => {
    configureToken(context);
    const facilities = [
        "Arlanda Airport",
        "Central Aerodrome",
        "North Airfield",
        "Harbor Heliport",
        "Central Railway Station",
        "Central Train Station",
        "Central Bus Station",
        "Harbor Bus Terminal",
        "Harbor Ferry Terminal"
    ];
    context.mock.method(globalThis, "fetch", async () =>
        Response.json({
            features: [
                ...facilities.map((name, index) => city(`facility-${index}`, name, "Sweden", "SE")),
                city("busan", "Busan", "South Korea", "KR"),
                city("airlie-beach", "Airlie Beach", "Australia", "AU")
            ]
        })
    );
    const response = await request(appWithQuota()).get("/api/v1/destinations/search").query({ q: "Air", limit: 2 });
    assert.equal(response.status, 200);
    assert.deepEqual(
        response.body.data.map((result: { id: string }) => result.id),
        ["busan", "airlie-beach"]
    );
});

test("Lisboa alias accepts the Portuguese city while retaining Mapbox identity and coordinates", async (context) => {
    configureToken(context);
    context.mock.method(globalThis, "fetch", async () =>
        Response.json({ features: [city("lisboa-provider-id", "Lisboa", "Portugal", "PT")] })
    );
    const response = await request(appWithQuota()).get("/api/v1/destinations/search").query({ q: "Lisboa" });
    assert.equal(response.status, 200);
    assert.equal(response.body.data.length, 1);
    assert.equal(response.body.data[0].id, "lisboa-provider-id");
    assert.equal(response.body.data[0].name, "Lisboa");
    assert.equal(response.body.data[0].countryCode, "PRT");
    assert.equal(response.body.data[0].latitude, 38.72);
    assert.equal(response.body.data[0].longitude, -9.14);
});

test("new cities are accepted without a local catalog and repeated provider IDs appear only once", async (context) => {
    configureToken(context);
    const upstream = context.mock.method(globalThis, "fetch", async (input: URL | string | Request) => {
        assert.equal(new URL(String(input)).searchParams.get("q"), "Tórshavn");
        return Response.json({
            features: [
                city("torshavn", "Tórshavn", "Faroe Islands", "FO"),
                city("torshavn", "Tórshavn duplicate", "Faroe Islands", "FO"),
                city("klaksvik", "Klaksvík", "Faroe Islands", "FO")
            ]
        });
    });
    const response = await request(appWithQuota())
        .get("/api/v1/destinations/search")
        .query({ q: "Tórshavn", limit: 2 });
    assert.equal(response.status, 200);
    assert.deepEqual(
        response.body.data.map((result: { name: string }) => result.name),
        ["Tórshavn", "Klaksvík"]
    );
    assert.equal(response.body.data[0].countryCode, "FRO");
    assert.equal(upstream.mock.callCount(), 1);
});

test("a query with no provider match remains empty instead of inventing a city result", async (context) => {
    configureToken(context);
    context.mock.method(globalThis, "fetch", async () => Response.json({ features: [] }));
    const response = await request(appWithQuota()).get("/api/v1/destinations/search").query({ q: "Kyoto" });
    assert.equal(response.status, 200);
    assert.deepEqual(response.body.data, []);
});

test("autocomplete rejects malformed input before contacting Mapbox and keeps provider failures safe", async (context) => {
    configureToken(context);
    const upstream = context.mock.method(
        globalThis,
        "fetch",
        async () => new Response("secret provider diagnostics sk.destination-test-only", { status: 403 })
    );
    const app = appWithQuota();
    for (const query of [{ q: "P" }, { q: "Paris", limit: 11 }, { q: "Paris", country: "US" }]) {
        const invalid = await request(app).get("/api/v1/destinations/search").query(query);
        assert.equal(invalid.status, 400);
        assert.equal(invalid.body.error.code, "INVALID_REQUEST");
    }
    assert.equal(upstream.mock.callCount(), 0);
    const failure = await request(app).get("/api/v1/destinations/search").query({ q: "Paris" });
    assert.equal(failure.status, 502);
    assert.equal(failure.body.error.code, "PROVIDER_FAILED");
    assert.equal(JSON.stringify(failure.body).includes("sk.destination-test-only"), false);
    assert.equal(JSON.stringify(failure.body).includes("secret provider diagnostics"), false);
});
