import assert from "node:assert/strict";
import test from "node:test";
import { isPublicImageAddress, downloadLibraryImage } from "../src/features/image-library/image-library.download.js";
import { unsplashReferenceId } from "../src/features/image-library/image-library.schemas.js";
import { createLibraryService } from "../src/features/image-library/image-library.service.js";

test("agent registration accepts Unsplash IDs and photo pages, preserving IDs inside readable slugs", () => {
    assert.equal(unsplashReferenceId("AiC8MRukmBg"), "AiC8MRukmBg");
    assert.equal(unsplashReferenceId("https://unsplash.com/photos/AiC8MRukmBg?utm_source=test"), "AiC8MRukmBg");
    assert.equal(unsplashReferenceId("https://unsplash.com/photos/red-gates-AiC8MRukmBg"), "AiC8MRukmBg");
    assert.throws(() => unsplashReferenceId("https://other.test/photos/AiC8MRukmBg"));
    assert.throws(() => unsplashReferenceId("https://unsplash.com/collections/example"));
});

test("remote developer imports reject private networks, unsafe protocols and credential URLs", async () => {
    for (const value of [
        "127.0.0.1",
        "10.0.0.1",
        "172.16.0.1",
        "192.168.1.1",
        "169.254.169.254",
        "100.64.0.1",
        "::1",
        "::ffff:127.0.0.1",
        "fd00::1",
        "2001:db8::1",
        "invalid"
    ])
        assert.equal(isPublicImageAddress(value), false, value);
    assert.equal(isPublicImageAddress("8.8.8.8"), true);
    for (const value of [
        "http://example.test/image.jpg",
        "https://user:password@example.test/image.jpg",
        "https://127.0.0.1/image.jpg"
    ])
        await assert.rejects(downloadLibraryImage(value), { code: "INVALID_IMAGE_URL" });
});

test("direct Unsplash CDN links stay external and save supplied metadata without upload or API selection", async () => {
    const service = createLibraryService(
        {
            async find() {
                return null;
            },
            async list() {
                return [];
            },
            async save(assetKey, _revision, asset) {
                return { assetKey, revision: 1, asset, aliases: [], usages: [] };
            }
        },
        {
            async upload() {
                throw new Error("Must not upload Unsplash bytes");
            },
            async unsplash() {
                throw new Error("No API selection for a supplied direct CDN link");
            }
        }
    );
    const url = "https://images.unsplash.com/photo-1503899036084-c55cdd92da26?w=1200&ixid=tracking";
    const input = {
        assetKey: "agent.cover",
        expectedRevision: 0,
        alt: "Tokyo",
        credit: "Supplied photographer",
        sourceUrl: "https://unsplash.com/photos/example"
    };
    const image = await service.externalUnsplash(url, input);
    assert.equal(image.asset.url, url);
    assert.equal(image.asset.credit, input.credit);
    assert.equal(image.asset.cloudinaryPublicId, null);
    await assert.rejects(service.externalUnsplash("https://untrusted.test/image.jpg", input), {
        code: "INVALID_IMAGE_URL"
    });
});
