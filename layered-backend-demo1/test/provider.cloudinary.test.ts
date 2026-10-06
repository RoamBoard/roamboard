import assert from "node:assert/strict";
import test from "node:test";

import express from "express";
import request from "supertest";
import { v2 as cloudinary } from "cloudinary";

import { env } from "../src/config/env.js";
import { createProviderRouter } from "../src/features/providers/provider.routes.js";
import { loadCloudinaryAssets, normalizePhotoMetadata } from "../src/features/providers/provider.cloudinary.js";
import type { ProviderService } from "../src/features/providers/provider.service.js";
import { errorHandler } from "../src/middleware/error-handler.js";

function createFakeProviderService(receivedTypes: string[]): ProviderService {
  return {
    config: () => ({
      geoapify: { configured: false }, mapbox: { configured: false },
      unsplash: { configured: false },
      googlePlaces: { configured: false, billingRequired: true },
      cloudinary: { configured: true },
    }),
    mapboxMapSession: async () => ({ publicToken: "pk.test" }),
    mapboxSearch: async () => [],
    mapboxBoardSearch: async () => [],
    mapboxDestinationSearch: async () => [],
    mapboxReverse: async (latitude, longitude) => ({ id: "mapbox-test", label: "Stockholm, Sweden", detail: "Testgatan 1", type: "address", latitude, longitude }),
    mapboxBoardReverse: async (latitude, longitude) => ({ id: "mapbox-test", label: "Stockholm, Sweden", detail: "Testgatan 1", type: "address", latitude, longitude }),
    mapboxRoute: async (_points, profile) => ({ profile, distanceKm: 0, durationMinutes: 0, geometry: [] }),
    unsplashSearch: async () => [],
    googlePlacesSearch: async () => [],
    googlePlaceDetails: async (placeId) => ({ id: placeId, address: "", latitude: 0, longitude: 0, types: [], googleMapsUrl: "" }),
    saveGooglePlace: async (placeId) => ({ placeId, savedAt: "2026-10-01T00:00:00.000Z" }),
    savedGooglePlaces: async () => [],
    deleteSavedGooglePlace: async () => undefined,
    cloudinaryDelivery: () => "",
    cloudinaryUpload: async (file) => {
      receivedTypes.push(file.mimetype);
      return {
        publicId: "roamboard/user-uploads/test",
        url: "https://example.com/test.heic",
        thumbnailUrl: "https://example.com/test.jpg",
        width: 1,
        height: 1,
        format: "heic",
        bytes: file.size,
        createdAt: "2026-10-01T00:00:00Z",
      };
    },
    cloudinaryAssets: async () => [],
    cloudinaryMetadata: async () => ({
      capturedAt: null,
      camera: null,
      orientation: null,
      latitude: null,
      longitude: null,
      hasGps: false,
      raw: {},
    }),
  };
}

test("accepts a HEIC upload when the browser reports a generic MIME type", async () => {
  const receivedTypes: string[] = [];
  const app = express();
  app.use("/api/v1/providers", createProviderRouter(createFakeProviderService(receivedTypes)));
  app.use(errorHandler);

  const response = await request(app)
    .post("/api/v1/providers/cloudinary/upload")
    .attach("file", Buffer.from("prototype image"), {
      filename: "photo.heic",
      contentType: "application/octet-stream",
    });

  assert.equal(response.status, 201);
  assert.equal(response.body.data.format, "heic");
  assert.deepEqual(receivedTypes, ["application/octet-stream"]);
});

test("rejects a generic non-image upload with a useful message", async () => {
  const app = express();
  app.use("/api/v1/providers", createProviderRouter(createFakeProviderService([])));
  app.use(errorHandler);

  const response = await request(app)
    .post("/api/v1/providers/cloudinary/upload")
    .attach("file", Buffer.from("not an image"), {
      filename: "notes.txt",
      contentType: "application/octet-stream",
    });

  assert.equal(response.status, 415);
  assert.match(response.body.error.message, /image file supported by Cloudinary/i);
});

test("normalizes Cloudinary degree-minute-second GPS metadata", () => {
  const metadata = normalizePhotoMetadata({
    Make: "Apple",
    Model: "iPhone 17",
    DateTimeOriginal: "2026:09:18 18:22:48",
    GPSLatitude: "59 deg 20' 32.94\" N",
    GPSLongitude: "18 deg 2' 49.78\" E",
  });

  assert.equal(metadata.camera, "Apple iPhone 17");
  assert.equal(metadata.capturedAt, "2026:09:18 18:22:48");
  assert.equal(metadata.hasGps, true);
  assert.ok(metadata.latitude !== null && Math.abs(metadata.latitude - 59.342483) < 0.000001);
  assert.ok(metadata.longitude !== null && Math.abs(metadata.longitude - 18.047161) < 0.000001);
});

test("Cloudinary HEIC asset listings provide browser-negotiated cover and thumbnail delivery", async (context) => {
  const originalConfig = { CLOUDINARY_CLOUD_NAME: env.CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY: env.CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET: env.CLOUDINARY_API_SECRET };
  Object.assign(env, { CLOUDINARY_CLOUD_NAME: "test-cloud", CLOUDINARY_API_KEY: "test-key", CLOUDINARY_API_SECRET: "test-secret" });
  context.mock.method(cloudinary.api, "resources_by_tag", async () => ({ resources: [{
    public_id: "roamboard/user-uploads/castle", secure_url: "https://res.cloudinary.com/test-cloud/image/upload/v1/castle.heic",
    width: 1200, height: 800, format: "heic", bytes: 1234, created_at: "2026-10-01T00:00:00Z",
  }] }));
  try {
    const assets = await loadCloudinaryAssets();
    assert.equal(assets.length, 1);
    assert.equal(assets[0]?.publicId, "roamboard/user-uploads/castle");
    assert.match(assets[0]?.url ?? "", /^https:\/\/res\.cloudinary\.com\/test-cloud\/image\/upload\//);
    assert.match(assets[0]?.url ?? "", /(?:,|\/)f_auto(?:,|\/)/);
    assert.match(assets[0]?.thumbnailUrl ?? "", /(?:,|\/)f_auto(?:,|\/)/);
    assert.ok(!assets[0]?.url.endsWith(".heic"));
    assert.equal(assets[0]?.format, "heic");
  } finally {
    Object.assign(env, originalConfig);
  }
});
