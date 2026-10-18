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

function city(id: string, name: string, country: string, countryCode: string, featureType = "place", region = "") {
    return {
        id,
        geometry: { coordinates: [-9.14, 38.72] },
        properties: {
            name,
            feature_type: featureType,
            place_formatted: `${country}`,
            context: {
                country: { name: country, country_code: countryCode },
                ...(region ? { region: { name: region } } : {})
            }
        }
    };
}

test("destination autocomplete forwards the query to unrestricted global country, region and city geocoding", async (context) => {
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
    assert.deepEqual(urls[0]?.searchParams.get("types")?.split(",").sort(), ["country", "place", "region"]);
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

test("a qualified city query selects the requested namesake without irrelevant nearby destinations", async (context) => {
    configureToken(context);
    context.mock.method(globalThis, "fetch", async (input: URL | string | Request) => {
        const url = new URL(String(input));
        assert.equal(url.searchParams.get("q"), "Stockholm Wisconsin");
        for (const filter of ["country", "bbox", "proximity"]) assert.equal(url.searchParams.has(filter), false);
        return Response.json({
            features: [
                city("stockholm-sweden", "Stockholm", "Sweden", "SE"),
                city("stockholm-wisconsin", "Stockholm", "United States", "US", "place", "Wisconsin"),
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
        ["stockholm-wisconsin"]
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
                city("sao-vicente", "São Vicente", "Cape Verde", "CV")
            ]
        })
    );
    const response = await request(appWithQuota()).get("/api/v1/destinations/search").query({ q: "Sao", limit: 2 });
    assert.equal(response.status, 200);
    assert.deepEqual(
        response.body.data.map((result: { id: string }) => result.id),
        ["sao-tome", "sao-vicente"]
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
    const app = appWithQuota();
    for (const [query, ids] of [
        ["Air", ["airlie-beach"]],
        ["Bsn", ["busan", "airlie-beach"]]
    ] as const) {
        const response = await request(app).get("/api/v1/destinations/search").query({ q: query, limit: 2 });
        assert.equal(response.status, 200);
        assert.deepEqual(
            response.body.data.map((result: { id: string }) => result.id),
            ids
        );
    }
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
        assert.equal(new URL(String(input)).searchParams.get("q"), "Tor");
        return Response.json({
            features: [
                city("torshavn", "Tórshavn", "Faroe Islands", "FO"),
                city("torshavn", "Tórshavn duplicate", "Faroe Islands", "FO"),
                city("torgau", "Torgau", "Germany", "DE")
            ]
        });
    });
    const response = await request(appWithQuota()).get("/api/v1/destinations/search").query({ q: "Tor", limit: 2 });
    assert.equal(response.status, 200);
    assert.deepEqual(
        response.body.data.map((result: { name: string }) => result.name),
        ["Tórshavn", "Torgau"]
    );
    assert.equal(response.body.data[0].countryCode, "FRO");
    assert.equal(upstream.mock.callCount(), 1);
});

test("exact Kabul and Krabi regions outrank prefixes, and cross-type namesakes keep provider order", async (context) => {
    configureToken(context);
    context.mock.method(globalThis, "fetch", async (input: URL | string | Request) => {
        const query = new URL(String(input)).searchParams.get("q");
        return Response.json({
            features:
                query === "Kabul"
                    ? [
                          city("kabulasoke", "Kabulasoke", "Uganda", "UG"),
                          city("kabul-region", "Kabul", "Afghanistan", "AF", "region"),
                          city("kabul-city", "Kabul", "Afghanistan", "AF")
                      ]
                    : [
                          city("krabilova", "Krabilova", "Estonia", "EE"),
                          city("krabi-region", "Krabi", "Thailand", "TH", "region"),
                          city("krabi-estonia", "Krabi", "Estonia", "EE"),
                          city("krabi-city", "Krabi", "Thailand", "TH")
                      ]
        });
    });
    const app = appWithQuota();
    for (const [query, id, countryCode] of [
        ["Kabul", "kabul-region", "AFG"],
        ["Krabi", "krabi-region", "THA"]
    ]) {
        const response = await request(app).get("/api/v1/destinations/search").query({ q: query, limit: 3 });
        assert.equal(response.status, 200);
        assert.deepEqual(
            response.body.data.map((result: { id: string }) => result.id),
            [id]
        );
        assert.equal(response.body.data[0].placeType, "region");
        assert.equal(response.body.data[0].city, null);
        assert.equal(response.body.data[0].countryCode, countryCode);
    }
});

test("Bali, Florida, Indonesia and Bahamas retain administrative type and country identity", async (context) => {
    configureToken(context);
    const cases = [
        { query: "Bali", name: "Bali", country: "Indonesia", code: "ID", expectedCode: "IDN", type: "region" },
        {
            query: "Florida",
            name: "Florida",
            country: "United States",
            code: "US",
            expectedCode: "USA",
            type: "region"
        },
        {
            query: "Indonesia",
            name: "Indonesia",
            country: "Indonesia",
            code: "ID",
            expectedCode: "IDN",
            type: "country"
        },
        {
            query: "Bahamas",
            name: "The Bahamas",
            country: "The Bahamas",
            code: "BS",
            expectedCode: "BHS",
            type: "country"
        }
    ];
    context.mock.method(globalThis, "fetch", async (input: URL | string | Request) => {
        const query = new URL(String(input)).searchParams.get("q");
        const item = cases.find((item) => item.query === query)!;
        return Response.json({
            features: [
                city("prefix-result", `${item.query} Gardens`, "United States", "US"),
                city("requested", item.name, item.country, item.code, item.type)
            ]
        });
    });
    const app = appWithQuota();
    for (const item of cases) {
        const response = await request(app).get("/api/v1/destinations/search").query({ q: item.query });
        assert.equal(response.status, 200);
        assert.equal(response.body.data.length, 1);
        assert.equal(response.body.data[0].id, "requested");
        assert.equal(response.body.data[0].name, item.name);
        assert.equal(response.body.data[0].country, item.country);
        assert.equal(response.body.data[0].countryCode, item.expectedCode);
        assert.equal(response.body.data[0].placeType, item.type);
        assert.equal(response.body.data[0].city, null);
    }
});

test("provider aliases rank exact matches without exposing internal aliases in the response", async (context) => {
    configureToken(context);
    const alias = city("lisbon", "Lisboa", "Portugal", "PT");
    const disguisedAirport = city("airport", "Lisboa Airport", "Portugal", "PT");
    context.mock.method(globalThis, "fetch", async () =>
        Response.json({
            features: [
                { ...disguisedAirport, properties: { ...disguisedAirport.properties, name_preferred: "Lisboa" } },
                city("lisboa-prefix", "Lisboa Nova", "Portugal", "PT"),
                { ...alias, properties: { ...alias.properties, name_preferred: "Lisbon" } }
            ]
        })
    );
    const response = await request(appWithQuota()).get("/api/v1/destinations/search").query({ q: "Lisboa" });
    assert.equal(response.status, 200);
    assert.equal(response.body.data.length, 1);
    assert.equal(response.body.data[0].id, "lisbon");
    assert.equal(response.body.data[0].name, "Lisbon");
    assert.deepEqual(
        Object.keys(response.body.data[0]).sort(),
        [
            "id",
            "name",
            "address",
            "latitude",
            "longitude",
            "placeType",
            "context",
            "country",
            "countryCode",
            "city"
        ].sort()
    );
});

test("qualified Paris queries prefer region and country identity over the unqualified provider favorite", async (context) => {
    configureToken(context);
    context.mock.method(globalThis, "fetch", async (input: URL | string | Request) => {
        assert.equal(new URL(String(input)).searchParams.get("q"), "Paris Texas United States");
        return Response.json({
            features: [
                city("paris-france", "Paris", "France", "FR"),
                city("paris-texas", "Paris", "United States", "US", "place", "Texas")
            ]
        });
    });
    const response = await request(appWithQuota())
        .get("/api/v1/destinations/search")
        .query({ q: "Paris Texas United States" });
    assert.equal(response.status, 200);
    assert.deepEqual(
        response.body.data.map((result: { id: string }) => result.id),
        ["paris-texas"]
    );
});

test("prefixes suppress fuzzy alternatives while short queries preserve provider ordering over obscure exact matches", async (context) => {
    configureToken(context);
    context.mock.method(globalThis, "fetch", async (input: URL | string | Request) => {
        const query = new URL(String(input)).searchParams.get("q");
        return Response.json({
            features:
                query === "San"
                    ? [
                          city("san-francisco", "San Francisco", "United States", "US"),
                          city("san", "San", "Mali", "ML"),
                          city("san-diego", "San Diego", "United States", "US")
                      ]
                    : query === "Cphgn"
                      ? [
                            city("copenhagen", "Copenhagen", "Denmark", "DK"),
                            city("copenhagen-us", "Copenhagen", "United States", "US"),
                            city("cope", "Cope", "United States", "US")
                        ]
                      : [
                            city("fuzzy", "Stockport", "United Kingdom", "GB"),
                            city("prefix", "Stockholm", "Sweden", "SE")
                        ]
        });
    });
    const app = appWithQuota();
    for (const [query, ids] of [
        ["San", ["san-francisco", "san", "san-diego"]],
        ["StocKHo", ["prefix"]],
        ["Cphgn", ["copenhagen", "cope"]]
    ] as const) {
        const response = await request(app).get("/api/v1/destinations/search").query({ q: query });
        assert.equal(response.status, 200);
        assert.deepEqual(
            response.body.data.map((result: { id: string }) => result.id),
            ids
        );
    }
});

test("a close whole-city spelling wins over a longer leading region prefix", async (context) => {
    configureToken(context);
    context.mock.method(globalThis, "fetch", async () =>
        Response.json({
            features: [
                city("marrakesh-safi", "Marrakesh-Safi", "Morocco", "MA", "region"),
                city("marrakech", "Marrakech", "Morocco", "MA")
            ]
        })
    );
    const response = await request(appWithQuota()).get("/api/v1/destinations/search").query({ q: "Marrakesh" });
    assert.equal(response.status, 200);
    assert.equal(response.body.data[0].id, "marrakech");
    assert.equal(response.body.data[0].placeType, "place");
    assert.equal(response.body.data[0].countryCode, "MAR");
});

test("a Bahamas typo promotes the closest country spelling while an exact Baham query retains its city", async (context) => {
    configureToken(context);
    context.mock.method(globalThis, "fetch", async () =>
        Response.json({
            features: [
                city("baham", "Baham", "Cameroon", "CM"),
                city("bahama", "Bahama", "United States", "US"),
                city("bahamas", "The Bahamas", "The Bahamas", "BS", "country")
            ]
        })
    );
    const app = appWithQuota();
    const typo = await request(app).get("/api/v1/destinations/search").query({ q: "bahams" });
    assert.equal(typo.status, 200);
    assert.equal(typo.body.data[0].id, "bahamas");
    assert.equal(typo.body.data[0].placeType, "country");
    assert.equal(typo.body.data[0].countryCode, "BHS");
    assert.equal(typo.body.data[0].city, null);
    const exact = await request(app).get("/api/v1/destinations/search").query({ q: "Baham" });
    assert.equal(exact.status, 200);
    assert.deepEqual(
        exact.body.data.map((result: { id: string }) => result.id),
        ["baham"]
    );
    assert.equal(exact.body.data[0].countryCode, "CMR");
});

test("an adjacent-letter typo promotes Copenhagen ahead of less similar provider results", async (context) => {
    configureToken(context);
    context.mock.method(globalThis, "fetch", async () =>
        Response.json({
            features: [
                city("cope", "Cope", "United States", "US"),
                city("copenhagen", "Copenhagen", "Denmark", "DK"),
                city("copenhagen-us", "Copenhagen", "United States", "US")
            ]
        })
    );
    const response = await request(appWithQuota()).get("/api/v1/destinations/search").query({ q: "Copnehagen" });
    assert.equal(response.status, 200);
    assert.equal(response.body.data[0].id, "copenhagen");
    assert.equal(response.body.data[0].countryCode, "DNK");
    assert.equal(response.body.data.filter((result: { name: string }) => result.name === "Copenhagen").length, 1);
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
