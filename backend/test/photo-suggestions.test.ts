import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import request from "supertest";
import {
    discoverPhotoSuggestions,
    selectPhotoSuggestion
} from "../src/features/providers/provider.photo-suggestions.js";
import { photoSuggestionSchema, photoSelectionSchema } from "../src/features/providers/provider.schemas.js";
import { createProviderRouter } from "../src/features/providers/provider.routes.js";
import { createProviderController } from "../src/features/providers/provider.controller.js";
import { errorHandler } from "../src/middleware/error-handler.js";
import type { ProviderService } from "../src/features/providers/provider.service.js";

const target = { name: "Siljan", category: "nature" as const, latitude: 61, longitude: 14.5, countryCode: "SWE" };
const area = { city: "Mora", region: "Dalarna", country: "Sweden", countryCode: "SWE" };
function photo(id: string, location: Record<string, unknown> = { name: "Dalarna, Sweden", country: "Sweden" }) {
    return {
        id,
        alt_description: "Lake landscape",
        location,
        urls: { regular: "https://images.unsplash.com/test", small: "https://images.unsplash.com/test?w=400" },
        user: { name: "Photographer", links: { html: "https://unsplash.com/@photographer" } },
        links: {
            html: `https://unsplash.com/photos/${id}`,
            download_location: `https://api.unsplash.com/photos/${id}/download`
        }
    };
}

test("nearby failures reserve regional inspections, metadata-only regions are eligible, and discovery never selects", async () => {
    const calls: string[] = [];
    let searches = 0;
    const results = await discoverPhotoSuggestions(target, {
        area: async () => area,
        request: async (path) => {
            calls.push(path);
            if (path.startsWith("/search"))
                return {
                    results: (++searches === 1 ? ["unknown", "wrong"] : ["regional", "duplicate"]).map((id) => ({ id }))
                };
            if (path.includes("unknown")) return photo("unknown", {});
            if (path.includes("wrong")) return photo("wrong", { country: "Norway", name: "Dalarna" });
            return photo(path.split("/").at(-1)!);
        }
    });
    assert.equal(searches, 2);
    assert.equal(calls.filter((path) => path.startsWith("/photos/")).length, 4);
    assert.equal(
        calls.some((path) => path.includes("download")),
        false
    );
    assert.equal(results.length, 2);
    assert.deepEqual(results[0]!.context, { kind: "illustrative", scope: "region", locationLabel: "Dalarna, Sweden" });
});

test("contradictory GPS and unrelated subjects are rejected despite matching regional names", async () => {
    const results = await discoverPhotoSuggestions(target, {
        area: async (point) =>
            point.latitude === target.latitude ? area : { ...area, countryCode: "NOR", country: "Norway" },
        request: async (path) =>
            path.startsWith("/search")
                ? { results: [{ id: "gps" }, { id: "subject" }] }
                : path.endsWith("gps")
                  ? photo("gps", { name: "Dalarna, Sweden", position: { latitude: 62, longitude: 10 } })
                  : { ...photo("subject"), alt_description: "Coffee in a cafe" }
    });
    assert.deepEqual(results, []);
});

test("selection revalidates one canonical ID and records one canonical download without search", async () => {
    const calls: string[] = [];
    const selected = await selectPhotoSuggestion(
        { ...target, photoId: "regional" },
        {
            area: async () => area,
            request: async (path) => {
                calls.push(path);
                return photo("regional");
            }
        }
    );
    assert.equal(selected.context.scope, "region");
    assert.deepEqual(calls, ["/photos/regional", "/photos/regional/download"]);
    await assert.rejects(
        selectPhotoSuggestion(
            { ...target, photoId: "regional" },
            {
                area: async () => area,
                request: async () => photo("other")
            }
        ),
        { code: "PHOTO_SUGGESTION_NOT_ELIGIBLE" }
    );
});

test("suggestion schemas reject provider URLs, unknown categories, malformed coordinates and missing selection ID", () => {
    assert.equal(photoSuggestionSchema.safeParse(target).success, true);
    for (const input of [
        { ...target, url: "https://example.com" },
        { ...target, latitude: 91 },
        { ...target, category: "invented" }
    ]) {
        assert.equal(photoSuggestionSchema.safeParse(input).success, false);
    }
    assert.equal(photoSelectionSchema.safeParse(target).success, false);
});

test("suggestion routes require session and selection Origin before provider work", async () => {
    const controller = createProviderController({} as ProviderService);
    const app = express();
    app.use(express.json());
    app.use(
        "/api/v1/providers",
        createProviderRouter(controller, (_req, res, next) => {
            if (_req.headers["x-test-user"]) res.locals.user = { userId: "owner" };
            next();
        })
    );
    app.use(errorHandler);
    assert.equal(
        (await request(app).get("/api/v1/providers/unsplash/activity-photo-suggestions").query(target)).status,
        401
    );
    assert.equal(
        (
            await request(app)
                .post("/api/v1/providers/unsplash/activity-photo-suggestions/select")
                .set("x-test-user", "owner")
                .set("Origin", "https://wrong.example")
                .send({ ...target, photoId: "id" })
        ).status,
        403
    );
});
