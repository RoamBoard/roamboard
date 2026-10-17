import assert from "node:assert/strict";
import test from "node:test";
import { v2 as cloudinary } from "cloudinary";
import { createCloudinaryProvider } from "../src/features/images/images.cloudinary.js";

test("deleted Cloudinary files report a missing asset, while saved IDs and permissions remain untouched", async () => {
    const previousFetch = globalThis.fetch;
    const previousResource = cloudinary.api.resource;
    const previous = [
        process.env.CLOUDINARY_CLOUD_NAME,
        process.env.CLOUDINARY_API_KEY,
        process.env.CLOUDINARY_API_SECRET
    ];
    process.env.CLOUDINARY_CLOUD_NAME = "test-cloud";
    process.env.CLOUDINARY_API_KEY = "test-key";
    process.env.CLOUDINARY_API_SECRET = "test-secret";
    let calls = 0;
    globalThis.fetch = async (input) => {
        calls++;
        assert.match(String(input), /\/image\/authenticated\//);
        return Response.json({ error: { message: "Resource not found" } }, { status: 404 });
    };
    cloudinary.api.resource = (() =>
        Promise.reject({ error: { http_code: 404, message: "Resource not found" } })) as typeof cloudinary.api.resource;
    try {
        const provider = createCloudinaryProvider();
        await assert.rejects(provider.openVariant("roamboard/missing-file", "display"), {
            statusCode: 404,
            code: "IMAGE_ASSET_MISSING"
        });
        assert.equal(calls, 1, "missing private files must not retry or fall back to public delivery");
        assert.equal(
            await provider.inspect("roamboard/missing-file"),
            null,
            "nested SDK 404s represent missing storage, not successful verification"
        );
    } finally {
        globalThis.fetch = previousFetch;
        cloudinary.api.resource = previousResource;
        for (const [index, key] of ["CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"].entries()) {
            if (previous[index] === undefined) delete process.env[key];
            else process.env[key] = previous[index];
        }
    }
});
