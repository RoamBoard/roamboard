import assert from "node:assert/strict";
import test from "node:test";
import { searchMapboxCities, searchMapboxPermanent } from "../src/features/destinations/destination.providers.js";
import { reverseMapbox } from "../src/features/providers/provider.providers.js";

test("all permanent Mapbox adapters reject before any provider request", async (context) => {
  const dispatched = { calls: 0 };
  context.mock.method(globalThis, "fetch", async () => { dispatched.calls++; throw new Error("Unexpected paid API call"); });
  await assert.rejects(async () => searchMapboxCities("DK", "Copenhagen", 5, "pk.test"));
  await assert.rejects(async () => searchMapboxPermanent("Copenhagen", 5, "pk.test"));
  await assert.rejects(reverseMapbox(59.3425, 18.0472, "pk.test", true));
  assert.equal(dispatched.calls, 0);
});

test("temporary reverse geocoding still formats context without permanent billing", async (context) => {
  context.mock.method(globalThis, "fetch", async (input: string | URL | Request) => {
    const url = new URL(String(input));
    assert.notEqual(url.searchParams.get("permanent"), "true");
    return new Response(JSON.stringify({ features: [{ id: "mapbox-neighborhood", properties: {
      feature_type: "neighborhood", name_preferred: "Odenplan",
      context: { place: { name: "Stockholm" }, country: { name: "Sweden" } },
    } }] }), { status: 200 });
  });
  const result = await reverseMapbox(59.3425, 18.0472, "pk.test");
  assert.equal(result.label, "Odenplan, Stockholm, Sweden");
  assert.equal(result.detail, "");
  assert.equal(result.type, "neighborhood");
});
