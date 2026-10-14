import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import express from "express";
import request from "supertest";
import { env } from "../src/config/env.js";
import { createProviderRouter } from "../src/features/providers/provider.routes.js";
import { createProviderService } from "../src/features/providers/provider.service.js";
import { createMemoryGooglePlaceReferenceRepository } from "../src/features/providers/provider.google-place-repository.js";
import { searchGeoapify, reverseGeoapify } from "../src/features/providers/provider.geoapify.js";
import { createMemoryQuotaRepository } from "../src/features/quotas/quota.repository.js";
import { createQuotaPolicies } from "../src/features/quotas/quota.policies.js";
import { createQuotaService } from "../src/features/quotas/quota.service.js";
import { errorHandler } from "../src/middleware/error-handler.js";

const feature = {
    geometry: { coordinates: [12.5683, 55.6761] },
    properties: {
        place_id: "geoapify-copenhagen",
        name: "Copenhagen",
        city: "Copenhagen",
        country: "Denmark",
        country_code: "dk",
        formatted: "Copenhagen, Denmark",
        result_type: "city",
        lat: 55.6761,
        lon: 12.5683
    }
};
const response = () => new Response(JSON.stringify({ features: [feature] }), { status: 200 });
function app() {
    const quota = createQuotaService(
        createMemoryQuotaRepository(),
        createQuotaPolicies(),
        () => new Date("2026-10-01T12:30:00Z")
    );
    const value = express();
    value.use(
        "/providers",
        createProviderRouter(createProviderService(quota, createMemoryGooglePlaceReferenceRepository()))
    );
    value.use(errorHandler);
    return { value, quota };
}
function key(context: TestContext, value: string | undefined = "test-geoapify-key") {
    const previous = env.GEOAPIFY_API_KEY;
    env.GEOAPIFY_API_KEY = value;
    context.after(() => {
        env.GEOAPIFY_API_KEY = previous;
    });
}

test("Geoapify city search produces canonical stored destination fields", async (context) => {
    context.mock.method(globalThis, "fetch", async (input: string | URL | Request) => {
        const url = new URL(String(input));
        assert.equal(url.hostname, "api.geoapify.com");
        assert.equal(url.pathname, "/v1/geocode/search");
        assert.equal(url.searchParams.get("apiKey"), "test-key");
        assert.equal(url.searchParams.get("filter"), "countrycode:dk");
        assert.equal(url.searchParams.get("type"), "city");
        assert.equal(url.searchParams.has("permanent"), false);
        return response();
    });
    const [city] = await searchGeoapify("Copenhagen", 5, "test-key", "DK");
    assert.equal(city?.id, "geoapify:geoapify-copenhagen");
    assert.equal(city?.name, "Copenhagen");
    assert.equal(city?.latitude, 55.6761);
    assert.equal(city?.longitude, 12.5683);
    assert.equal(city?.placeType, "place");
    assert.equal(city?.countryCode, "DK");
    assert.equal(city?.city, "Copenhagen");
});

test("Geoapify reverse lookup returns durable identity and canonical coordinates", async (context) => {
    context.mock.method(globalThis, "fetch", async (input: string | URL | Request) => {
        const url = new URL(String(input));
        assert.equal(url.pathname, "/v1/geocode/reverse");
        assert.equal(url.searchParams.get("lat"), "55.6761");
        assert.equal(url.searchParams.get("lon"), "12.5683");
        return response();
    });
    const result = await reverseGeoapify(55.6761, 12.5683, "test-key");
    assert.equal(result.id, "geoapify:geoapify-copenhagen");
    assert.equal(result.latitude, 55.6761);
    assert.equal(result.longitude, 12.5683);
    assert.equal(result.countryCode, "DK");
});

for (const route of [
    "/locations/search",
    "/mapbox/board-search",
    "/locations/destinations",
    "/mapbox/board-destinations",
    "/locations/reverse",
    "/mapbox/board-reverse"
]) {
    test(`${route} dispatches exclusively to Geoapify through the real service`, async (context) => {
        key(context);
        const calls: URL[] = [];
        context.mock.method(globalThis, "fetch", async (input: string | URL | Request) => {
            calls.push(new URL(String(input)));
            return response();
        });
        const { value, quota } = app();
        const query = route.includes("destinations")
            ? { country: "DK", city: "Copenhagen" }
            : route.includes("reverse")
              ? { latitude: 55.6761, longitude: 12.5683 }
              : { q: "Copenhagen" };
        const result = await request(value).get(`/providers${route}`).query(query);
        assert.equal(result.status, 200, JSON.stringify(result.body));
        assert.equal(calls.length, 1);
        assert.equal(calls[0]?.hostname, "api.geoapify.com");
        assert.equal(calls[0]?.searchParams.get("apiKey"), "test-geoapify-key");
        const status = await quota.status();
        assert.equal(
            status.policies.find((p) => p.id === "geoapify.geocoding")?.windows.find((w) => w.period === "day")?.used,
            1
        );
        assert.equal(status.policies.find((p) => p.id === "mapbox.permanent_geocoding")?.windows[0]?.used, 0);
    });
}

test("forward and reverse calls share one hard quota and block fetch before dispatch", async (context) => {
    key(context);
    const dispatched = { calls: 0 };
    context.mock.method(globalThis, "fetch", async () => {
        dispatched.calls++;
        return response();
    });
    const { value } = app();
    assert.equal((await request(value).get("/providers/locations/search?q=Copenhagen")).status, 200);
    assert.equal((await request(value).get("/providers/locations/reverse?latitude=55&longitude=12")).status, 200);
    assert.equal(
        (await request(value).get("/providers/mapbox/board-destinations?country=DK&city=Copenhagen")).status,
        429
    );
    assert.equal(dispatched.calls, 2);
});

test("missing Geoapify key fails without falling back to configured Mapbox", async (context) => {
    key(context);
    env.GEOAPIFY_API_KEY = undefined;
    const previous = env.MAPBOX_ACCESS_TOKEN;
    env.MAPBOX_ACCESS_TOKEN = "pk.mapbox-test";
    context.after(() => {
        env.MAPBOX_ACCESS_TOKEN = previous;
    });
    const dispatched = { calls: 0 };
    context.mock.method(globalThis, "fetch", async () => {
        dispatched.calls++;
        return response();
    });
    const result = await request(app().value).get("/providers/locations/search?q=Copenhagen");
    assert.equal(result.status, 503);
    assert.equal(dispatched.calls, 0);
});

test("country-specific city search excludes other countries, addresses, and invalid coordinates", async (context) => {
    const variants = [
        feature,
        { ...feature, properties: { ...feature.properties, country_code: "se", country: "Sweden" } },
        { ...feature, properties: { ...feature.properties, result_type: "building" } },
        { ...feature, properties: { ...feature.properties, lat: 100 } }
    ];
    context.mock.method(
        globalThis,
        "fetch",
        async () => new Response(JSON.stringify({ features: variants }), { status: 200 })
    );
    const results = await searchGeoapify("Copenhagen", 5, "test-key", "DK");
    assert.equal(results.length, 1);
    assert.equal(results[0]?.countryCode, "DK");
    assert.equal(results[0]?.placeType, "place");
});

const stockholmAddress = {
    place_id: "stockholm-photo",
    lat: 59.342,
    lon: 18.049,
    city: "Stockholm",
    country: "Sweden",
    country_code: "se",
    result_type: "building",
    address_line1: "Västmannagatan 58",
    street: "Västmannagatan",
    housenumber: "58",
    formatted: "Västmannagatan 58, 113 25 Stockholm, Sweden"
};

function mockLocation(context: TestContext, properties: Record<string, unknown>) {
    const calls: URL[] = [];
    context.mock.method(globalThis, "fetch", async (input: string | URL | Request) => {
        calls.push(new URL(String(input)));
        return new Response(JSON.stringify({ features: [{ properties }] }), { status: 200 });
    });
    return calls;
}

test("photo GPS reverse lookup labels an ordinary address with its area and city through HTTP", async (context) => {
    key(context);
    const calls = mockLocation(context, { ...stockholmAddress, neighbourhood: "Odenplan" });
    const result = await request(app().value)
        .get("/providers/locations/reverse")
        .query({ latitude: 59.342, longitude: 18.049 });
    assert.equal(result.status, 200, JSON.stringify(result.body));
    assert.equal(result.body.data.label, "Odenplan, Stockholm");
    assert.equal(result.body.data.detail, "");
    assert.equal(result.body.data.type, "neighborhood");
    assert.equal(result.body.data.address, stockholmAddress.formatted);
    assert.equal(calls.length, 1, "area labeling must not consume an extra provider request");
});

test("reverse lookup with only an address uses the city and does not invent a landmark", async (context) => {
    mockLocation(context, stockholmAddress);
    const result = await reverseGeoapify(59.342, 18.049, "test-key");
    assert.equal(result.label, "Stockholm");
    assert.equal(result.detail, "");
    assert.equal(result.type, "place");
});

test("reverse lookup can obtain an area from nested source address metadata", async (context) => {
    mockLocation(context, { ...stockholmAddress, datasource: { raw: { "addr:suburb": "Odenplan" } } });
    const result = await reverseGeoapify(59.342, 18.049, "test-key");
    assert.equal(result.label, "Odenplan, Stockholm");
    assert.equal(result.detail, "");
    assert.equal(result.type, "neighborhood");
});

for (const place of [
    { name: "Café Pascal", categories: ["catering.restaurant"], expectedType: "restaurant" },
    { name: "Mall of Scandinavia", categories: ["commercial.shopping_mall"], expectedType: "shopping" },
    { name: "Vasa Museum", categories: ["entertainment.museum"], expectedType: "museum" },
    { name: "Stockholm Observatory", categories: ["tourism.sights"], expectedType: "landmark" }
]) {
    test(`reverse lookup preserves the named POI ${place.name} and its category`, async (context) => {
        mockLocation(context, {
            ...stockholmAddress,
            name: place.name,
            result_type: "amenity",
            categories: place.categories,
            suburb: "Vasastan"
        });
        const result = await reverseGeoapify(59.342, 18.049, "test-key");
        assert.equal(result.detail, place.name);
        assert.equal(result.type, place.expectedType);
        assert.equal(result.label, "Vasastan, Stockholm");
    });
}

test("reverse lookup recognizes a named cafe from a singular category", async (context) => {
    mockLocation(context, { ...stockholmAddress, name: "Café Pascal", category: "catering.cafe", suburb: "Vasastan" });
    const result = await reverseGeoapify(59.342, 18.049, "test-key");
    assert.equal(result.detail, "Café Pascal");
    assert.equal(result.type, "cafe");
    assert.equal(result.label, "Vasastan, Stockholm");
});

test("reverse lookup preserves a restaurant identified only by raw source tags", async (context) => {
    mockLocation(context, {
        ...stockholmAddress,
        datasource: { raw: { name: "Tranan", amenity: "restaurant", "addr:suburb": "Odenplan" } }
    });
    const result = await reverseGeoapify(59.342, 18.049, "test-key");
    assert.equal(result.detail, "Tranan");
    assert.equal(result.type, "restaurant");
    assert.equal(result.label, "Odenplan, Stockholm");
});

test("forward search distinguishes addresses and neighborhoods from named POIs", async (context) => {
    const cases = [
        { ...stockholmAddress, expectedType: "address" },
        { ...stockholmAddress, name: "Odenplan", result_type: "suburb", expectedType: "neighborhood" },
        {
            ...stockholmAddress,
            name: "Café Pascal",
            result_type: "amenity",
            categories: ["catering.cafe"],
            expectedType: "cafe"
        },
        { ...stockholmAddress, name: "Named place", result_type: "amenity", expectedType: "poi" }
    ];
    context.mock.method(
        globalThis,
        "fetch",
        async () =>
            new Response(JSON.stringify({ features: cases.map((properties) => ({ properties })) }), { status: 200 })
    );
    const results = await searchGeoapify("Stockholm", 5, "test-key");
    assert.deepEqual(
        results.map((result) => result.placeType),
        cases.map((place) => place.expectedType)
    );
    assert.equal(results[2]?.name, "Café Pascal");
});
