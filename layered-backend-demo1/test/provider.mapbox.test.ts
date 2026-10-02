import assert from "node:assert/strict";
import test from "node:test";

import { searchMapboxCities } from "../src/features/destinations/destination.providers.js";
import { reverseMapbox } from "../src/features/providers/provider.providers.js";

test("returns canonical city data from permanent structured geocoding", async (context) => {
  context.mock.method(globalThis, "fetch", async (input: string | URL | Request) => {
    const url = new URL(String(input));
    assert.equal(url.searchParams.get("country"), "DK");
    assert.equal(url.searchParams.get("place"), "Copenhagen");
    assert.equal(url.searchParams.get("types"), "place");
    assert.equal(url.searchParams.get("permanent"), "true");
    return new Response(JSON.stringify({
      features: [{
        id: "mapbox-copenhagen",
        geometry: { coordinates: [12.5683, 55.6761] },
        properties: {
          feature_type: "place",
          name: "Copenhagen",
          place_formatted: "Capital Region, Denmark",
          context: {
            place: { name: "Copenhagen" },
            country: { name: "Denmark", country_code: "DK" },
          },
        },
      }],
    }), { status: 200 });
  });

  const result = await searchMapboxCities("DK", "Copenhagen", 5, "pk.test");

  assert.deepEqual(result[0], {
    id: "mapbox-copenhagen",
    name: "Copenhagen",
    address: "Capital Region, Denmark",
    latitude: 55.6761,
    longitude: 12.5683,
    placeType: "place",
    context: ["Copenhagen", "Denmark"],
    country: "Denmark",
    countryCode: "DK",
    city: "Copenhagen",
  });
});

test("formats a reverse-geocoded address as area context plus concise detail", async (context) => {
  context.mock.method(globalThis, "fetch", async () => new Response(JSON.stringify({
    features: [{
      id: "mapbox-address",
      properties: {
        feature_type: "address",
        name: "Västmannagatan 58",
        context: {
          neighborhood: { name: "Odenplan" },
          place: { name: "Stockholm" },
          country: { name: "Sweden" },
          postcode: { name: "113 25" },
        },
      },
    }],
  }), { status: 200 }));

  const result = await reverseMapbox(59.3425, 18.0472, "pk.test");

  assert.deepEqual(result, {
    id: "mapbox-address",
    label: "Odenplan, Stockholm, Sweden",
    detail: "Västmannagatan 58",
    type: "address",
    latitude: 59.3425,
    longitude: 18.0472,
  });
});

test("does not repeat a top-level area name as its own detail", async (context) => {
  context.mock.method(globalThis, "fetch", async () => new Response(JSON.stringify({
    features: [{
      id: "mapbox-neighborhood",
      properties: {
        feature_type: "neighborhood",
        name_preferred: "Odenplan",
        context: {
          place: { name: "Stockholm" },
          country: { name: "Sweden" },
        },
      },
    }],
  }), { status: 200 }));

  const result = await reverseMapbox(59.3425, 18.0472, "pk.test");

  assert.equal(result.label, "Odenplan, Stockholm, Sweden");
  assert.equal(result.detail, "");
  assert.equal(result.type, "neighborhood");
});
