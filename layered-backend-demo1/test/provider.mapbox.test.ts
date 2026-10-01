import assert from "node:assert/strict";
import test from "node:test";

import { reverseMapbox } from "../src/features/providers/provider.providers.js";

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
