import assert from "node:assert/strict";
import test from "node:test";
import { createLibraryProvider } from "../src/features/image-library/image-library.provider.js";
import type { QuotaService } from "../src/features/quotas/quota.service.js";

test("Unsplash selection verifies canonical metadata and records a download without rehosting image bytes", async () => {
    const originalFetch = globalThis.fetch;
    const oldKey = process.env.UNSPLASH_ACCESS_KEY;
    process.env.UNSPLASH_ACCESS_KEY = "test-only";
    const paths: string[] = [];
    let invalid = false;
    let reservations = 0;
    const quota: QuotaService = {
        async reserve() {},
        async run(policy, operation) {
            assert.equal(policy, "unsplash.requests");
            reservations++;
            return operation(async () => {});
        }
    };
    globalThis.fetch = async (input) => {
        const url = new URL(String(input));
        assert.equal(url.origin, "https://api.unsplash.com");
        paths.push(url.pathname);
        return Response.json(
            url.pathname.endsWith("/download")
                ? { url: "https://images.unsplash.com/example" }
                : {
                      urls: {
                          regular: "https://images.unsplash.com/example?ixid=tracking",
                          small: "https://images.unsplash.com/example?w=200"
                      },
                      user: {
                          name: "Photographer",
                          links: { html: invalid ? "javascript:alert(1)" : "https://unsplash.com/@photographer" }
                      },
                      links: {
                          html: "https://unsplash.com/photos/photo-id",
                          download_location: "https://api.unsplash.com/photos/photo-id/download?ixid=selection-tracking"
                      },
                      width: 1200,
                      height: 800,
                      alt_description: "A mountain"
                  }
        );
    };
    try {
        const provider = createLibraryProvider(quota);
        const asset = await provider.unsplash("photo-id");
        assert.deepEqual(paths, ["/photos/photo-id", "/photos/photo-id/download"]);
        assert.equal(asset.provider, "unsplash");
        assert.equal(asset.cloudinaryPublicId, null);
        assert.equal(asset.credit, "Photographer");
        assert.match(asset.photographerUrl, /utm_source=roamboard/);
        assert.match(asset.url, /ixid=tracking/);
        assert.equal(reservations, 2);
        invalid = true;
        await assert.rejects(provider.unsplash("photo-id"), { code: "UNSPLASH_PHOTO_UNAVAILABLE" });
        assert.equal(paths.length, 3, "invalid provider metadata must not trigger a download or be saved");
    } finally {
        globalThis.fetch = originalFetch;
        if (oldKey === undefined) delete process.env.UNSPLASH_ACCESS_KEY;
        else process.env.UNSPLASH_ACCESS_KEY = oldKey;
    }
});
