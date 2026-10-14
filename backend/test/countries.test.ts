import assert from "node:assert/strict";
import test from "node:test";
import request from "supertest";
import { createApp } from "../src/app.js";
import {
    isCountryCode,
    countryName,
    countryCodeForName,
    toCountryCode,
    toAlpha2CountryCode
} from "../src/shared/countries.js";

test("provider country conversion uses real bidirectional ISO mappings", () => {
    for (const [alpha2, alpha3] of [
        ["SE", "SWE"],
        ["NO", "NOR"],
        ["JP", "JPN"],
        ["FR", "FRA"],
        ["GB", "GBR"],
        ["US", "USA"],
        ["CH", "CHE"],
        ["KR", "KOR"]
    ] as const) {
        assert.equal(toCountryCode(alpha2.toLowerCase()), alpha3);
        assert.equal(toCountryCode(alpha3), alpha3);
        assert.equal(toAlpha2CountryCode(alpha3), alpha2);
    }
    for (const code of ["", "ZZ", "XXX", "XK", "XKX"]) {
        assert.equal(toCountryCode(code), null);
        assert.equal(toAlpha2CountryCode(code), null);
    }
});

test("country name lookup uses correct ISO alpha-3 rather than truncated names", () => {
    for (const [name, code] of [
        ["Sweden", "SWE"],
        ["Norway", "NOR"],
        ["Japan", "JPN"],
        ["France", "FRA"],
        ["United Kingdom", "GBR"],
        ["United States", "USA"],
        ["Switzerland", "CHE"],
        ["South Korea", "KOR"]
    ] as const) {
        assert.equal(isCountryCode(code), true);
        assert.equal(countryName(code), name);
        assert.equal(countryCodeForName(name.toLowerCase()), code);
    }
    for (const code of ["SE", "NO", "JP", "FR", "GB", "US", "CH", "KR", "XXX", "XKX"]) {
        assert.equal(isCountryCode(code), false);
    }
    assert.equal(countryCodeForName("not a country"), null);
});

test("application country filters accept ISO3 and convert Geoapify requests to provider ISO2", async (context) => {
    const originalKey = process.env.GEOAPIFY_API_KEY;
    process.env.GEOAPIFY_API_KEY = "mock-geoapify-key";
    context.after(() => {
        if (originalKey === undefined) delete process.env.GEOAPIFY_API_KEY;
        else process.env.GEOAPIFY_API_KEY = originalKey;
    });
    const urls: URL[] = [];
    const app = createApp({
        quotaService: {
            async reserve() {},
            async run(_id, operation) {
                return operation();
            }
        }
    });
    context.mock.method(globalThis, "fetch", async (input: URL | string | Request) => {
        urls.push(new URL(String(input)));
        return Response.json({
            features: [
                {
                    properties: {
                        place_id: "stockholm",
                        name: "Stockholm",
                        city: "Stockholm",
                        country: "Sweden",
                        country_code: "se",
                        lat: 59.33,
                        lon: 18.07,
                        result_type: "city"
                    }
                }
            ]
        });
    });
    const selected = await request(app).get("/api/v1/providers/locations/destinations?country=SWE&city=Stockholm");
    assert.equal(selected.status, 200);
    assert.equal(selected.body.data[0].countryCode, "SWE");
    assert.equal(urls[0]?.searchParams.get("filter"), "countrycode:se");
    const reversed = await request(app).get("/api/v1/providers/locations/reverse?latitude=59.33&longitude=18.07");
    assert.equal(reversed.status, 200);
    assert.equal(reversed.body.data.countryCode, "SWE");
    for (const code of ["SE", "XXX", "XKX"]) {
        assert.equal(
            (
                await request(app)
                    .get("/api/v1/providers/locations/destinations")
                    .query({ country: code, city: "Stockholm" })
            ).status,
            400
        );
    }
    assert.equal(urls.length, 2);
});

test("Mapbox city, POI and reverse responses convert upstream ISO2 into application ISO3", async (context) => {
    const originalToken = process.env.MAPBOX_ACCESS_TOKEN;
    process.env.MAPBOX_ACCESS_TOKEN = "sk.mock-token";
    context.after(() => {
        if (originalToken === undefined) delete process.env.MAPBOX_ACCESS_TOKEN;
        else process.env.MAPBOX_ACCESS_TOKEN = originalToken;
    });
    const app = createApp({
        quotaService: {
            async reserve() {},
            async run(_id, operation) {
                return operation();
            }
        }
    });
    context.mock.method(globalThis, "fetch", async () =>
        Response.json({
            features: [
                {
                    id: "paris",
                    geometry: { coordinates: [2.35, 48.86] },
                    properties: {
                        mapbox_id: "paris",
                        name: "Paris",
                        feature_type: "place",
                        context: { country: { name: "France", country_code: "fr" } }
                    }
                }
            ]
        })
    );
    for (const path of ["/api/v1/destinations/search?q=Paris", "/api/v1/providers/mapbox/search?q=Paris"]) {
        const response = await request(app).get(path);
        assert.equal(response.status, 200);
        assert.equal(response.body.data[0].countryCode, "FRA");
    }
    const reverse = await request(app).get("/api/v1/providers/mapbox/reverse?latitude=48.86&longitude=2.35");
    assert.equal(reverse.status, 200);
    assert.equal(reverse.body.data.countryCode, "FRA");
});
