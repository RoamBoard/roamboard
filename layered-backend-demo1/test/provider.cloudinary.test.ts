import assert from "node:assert/strict";
import test from "node:test";

import express from "express";
import request from "supertest";

import { createProviderRouter } from "../src/features/providers/provider.routes.js";
import { normalizePhotoMetadata } from "../src/features/providers/provider.cloudinary.js";
import type { ProviderService } from "../src/features/providers/provider.service.js";
import { errorHandler } from "../src/middleware/error-handler.js";

function createFakeProviderService(receivedTypes: string[]): ProviderService {
  return {
    config: () => ({
      mapbox: { configured: false },
      unsplash: { configured: false },
      googlePlaces: { configured: false, billingRequired: true },
      cloudinary: { configured: true },
    }),
    mapboxSearch: async () => [],
    mapboxReverse: async () => "",
    mapboxRoute: async (_points, profile) => ({ profile, distanceKm: 0, durationMinutes: 0, geometry: [] }),
    unsplashSearch: async () => [],
    googlePlacesSearch: async () => [],
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
