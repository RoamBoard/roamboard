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

const feature = { geometry: { coordinates: [12.5683, 55.6761] }, properties: {
  place_id: "geoapify-copenhagen", name: "Copenhagen", city: "Copenhagen", country: "Denmark",
  country_code: "dk", formatted: "Copenhagen, Denmark", result_type: "city", lat: 55.6761, lon: 12.5683,
} };
const response = () => new Response(JSON.stringify({ features: [feature] }), { status: 200 });
function app() {
  const quota = createQuotaService(createMemoryQuotaRepository(), createQuotaPolicies(), () => new Date("2026-10-01T12:30:00Z"));
  const value = express();
  value.use("/providers", createProviderRouter(createProviderService(quota, createMemoryGooglePlaceReferenceRepository())));
  value.use(errorHandler);
  return { value, quota };
}
function key(context: TestContext, value: string | undefined = "test-geoapify-key") {
  const previous = env.GEOAPIFY_API_KEY;
  env.GEOAPIFY_API_KEY = value;
  context.after(() => { env.GEOAPIFY_API_KEY = previous; });
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

for (const route of ["/locations/search", "/mapbox/board-search", "/locations/destinations", "/mapbox/board-destinations", "/locations/reverse", "/mapbox/board-reverse"]) {
  test(`${route} dispatches exclusively to Geoapify through the real service`, async (context) => {
    key(context);
    const calls: URL[] = [];
    context.mock.method(globalThis, "fetch", async (input: string | URL | Request) => { calls.push(new URL(String(input))); return response(); });
    const { value, quota } = app();
    const query = route.includes("destinations") ? { country: "DK", city: "Copenhagen" } : route.includes("reverse") ? { latitude: 55.6761, longitude: 12.5683 } : { q: "Copenhagen" };
    const result = await request(value).get(`/providers${route}`).query(query);
    assert.equal(result.status, 200, JSON.stringify(result.body));
    assert.equal(calls.length, 1);
    assert.equal(calls[0]?.hostname, "api.geoapify.com");
    assert.equal(calls[0]?.searchParams.get("apiKey"), "test-geoapify-key");
    const status = await quota.status();
    assert.equal(status.policies.find(p => p.id === "geoapify.geocoding")?.windows.find(w => w.period === "day")?.used, 1);
    assert.equal(status.policies.find(p => p.id === "mapbox.permanent_geocoding")?.windows[0]?.used, 0);
  });
}

test("forward and reverse calls share one hard quota and block fetch before dispatch", async (context) => {
  key(context);
  const dispatched = { calls: 0 };
  context.mock.method(globalThis, "fetch", async () => { dispatched.calls++; return response(); });
  const { value } = app();
  assert.equal((await request(value).get("/providers/locations/search?q=Copenhagen")).status, 200);
  assert.equal((await request(value).get("/providers/locations/reverse?latitude=55&longitude=12")).status, 200);
  assert.equal((await request(value).get("/providers/mapbox/board-destinations?country=DK&city=Copenhagen")).status, 429);
  assert.equal(dispatched.calls, 2);
});

test("missing Geoapify key fails without falling back to configured Mapbox", async (context) => {
  key(context);
  env.GEOAPIFY_API_KEY = undefined;
  const previous = env.MAPBOX_ACCESS_TOKEN;
  env.MAPBOX_ACCESS_TOKEN = "pk.mapbox-test";
  context.after(() => { env.MAPBOX_ACCESS_TOKEN = previous; });
  const dispatched = { calls: 0 };
  context.mock.method(globalThis, "fetch", async () => { dispatched.calls++; return response(); });
  const result = await request(app().value).get("/providers/locations/search?q=Copenhagen");
  assert.equal(result.status, 503);
  assert.equal(dispatched.calls, 0);
});




test("country-specific city search excludes other countries, addresses, and invalid coordinates", async (context) => {
  const variants = [feature,
    { ...feature, properties: { ...feature.properties, country_code: "se", country: "Sweden" } },
    { ...feature, properties: { ...feature.properties, result_type: "building" } },
    { ...feature, properties: { ...feature.properties, lat: 100 } },
  ];
  context.mock.method(globalThis, "fetch", async () => new Response(JSON.stringify({ features: variants }), { status: 200 }));
  const results = await searchGeoapify("Copenhagen", 5, "test-key", "DK");
  assert.equal(results.length, 1);
  assert.equal(results[0]?.countryCode, "DK");
  assert.equal(results[0]?.placeType, "place");
});
