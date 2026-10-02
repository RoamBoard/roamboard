import assert from "node:assert/strict";
import test from "node:test";

import express from "express";
import request from "supertest";

import { createProviderRouter } from "../src/features/providers/provider.routes.js";
import type { ProviderService } from "../src/features/providers/provider.service.js";
import { errorHandler } from "../src/middleware/error-handler.js";
import { AppError } from "../src/shared/app-error.js";

function fakeService(): ProviderService {
  const saved = new Set<string>();
  return {
    config: () => ({ mapbox: { configured: false }, unsplash: { configured: false }, googlePlaces: { configured: true, billingRequired: true }, cloudinary: { configured: false } }),
    mapboxMapSession: async () => ({ publicToken: "pk.test" }),
    mapboxSearch: async () => [],
    mapboxDestinationSearch: async () => [],
    mapboxReverse: async (latitude, longitude) => ({ id: "mapbox-test", label: "Stockholm, Sweden", detail: "Testgatan 1", type: "address", latitude, longitude }),
    mapboxRoute: async (_points, profile) => ({ profile, distanceKm: 0, durationMinutes: 0, geometry: [] }),
    unsplashSearch: async () => [],
    googlePlacesSearch: async () => [],
    googlePlaceDetails: async (placeId) => ({ id: placeId, address: "Stockholm", latitude: 59.33, longitude: 18.07, types: ["museum"], googleMapsUrl: `https://www.google.com/maps/search/?api=1&query_place_id=${placeId}` }),
    saveGooglePlace: async (placeId) => {
      saved.add(placeId);
      return { placeId, savedAt: "2026-10-01T00:00:00.000Z" };
    },
    savedGooglePlaces: async () => [...saved].map((placeId) => ({ placeId, savedAt: "2026-10-01T00:00:00.000Z" })),
    deleteSavedGooglePlace: async (placeId) => {
      if (!saved.delete(placeId)) throw new AppError(404, "The saved Google Place ID was not found.");
    },
    cloudinaryDelivery: () => "",
    cloudinaryUpload: async () => { throw new Error("unused"); },
    cloudinaryAssets: async () => [],
    cloudinaryMetadata: async () => ({ capturedAt: null, camera: null, orientation: null, latitude: null, longitude: null, hasGps: false, raw: {} }),
  };
}

function app() {
  const value = express();
  value.use(express.json());
  value.use("/api/v1/providers", createProviderRouter(fakeService()));
  value.use(errorHandler);
  return value;
}

test("saves, lists, fetches, and deletes a Google Place ID", async () => {
  const value = app();
  const placeId = "ChIJ-example";

  const created = await request(value).post("/api/v1/providers/google-places/saved").send({ placeId });
  assert.equal(created.status, 201);
  assert.equal(created.body.data.placeId, placeId);

  const listed = await request(value).get("/api/v1/providers/google-places/saved");
  assert.deepEqual(listed.body.data.map((item: { placeId: string }) => item.placeId), [placeId]);

  const details = await request(value).get(`/api/v1/providers/google-places/${placeId}`);
  assert.equal(details.status, 200);
  assert.equal(details.body.data.address, "Stockholm");

  assert.equal((await request(value).delete(`/api/v1/providers/google-places/saved/${placeId}`)).status, 204);
  assert.equal((await request(value).delete(`/api/v1/providers/google-places/saved/${placeId}`)).status, 404);
});

test("rejects malformed saved-place bodies", async () => {
  const response = await request(app()).post("/api/v1/providers/google-places/saved").send({ placeId: "", extra: true });
  assert.equal(response.status, 400);
});
