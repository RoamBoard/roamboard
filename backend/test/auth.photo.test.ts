import assert from "node:assert/strict";
import test from "node:test";
import type { ImagesRepository, UploadIntent } from "../src/features/images/images.types.js";
import { createGooglePhotoImporter } from "../src/features/auth/auth.photo.js";

const googleUrl = "https://lh3.googleusercontent.com/a/photo";

function photoImporter(
    inspect: (
        key: string
    ) => Promise<import("../src/features/images/images.types.js").ProviderAsset | null> = async () => null,
    images: Pick<ImagesRepository, "createIntent" | "completeIntent"> = {
        async createIntent() {},
        async completeIntent() {
            return 42;
        }
    }
) {
    const importer = createGooglePhotoImporter(
        {
            inspect,
            authorizeUpload(storageKey) {
                return {
                    uploadUrl: "https://upload.example.test/image",
                    method: "POST",
                    headers: {},
                    formFields: { public_id: storageKey, signature: "server-signature" }
                };
            }
        },
        images
    );
    return (url: string, previousStorageKey?: string) => importer(url, previousStorageKey, "google-user");
}

test("Google default photos reject untrusted hosts and protocols before making a request", async (context) => {
    const fetched = context.mock.method(globalThis, "fetch", async () => {
        assert.fail("An untrusted Google photo URL must not be fetched");
    });
    for (const url of [
        "http://lh3.googleusercontent.com/a",
        "https://attacker.test/a",
        "https://lh3.googleusercontent.com.attacker.test/a",
        "https://user@lh3.googleusercontent.com/a",
        "https://lh3.googleusercontent.com:8443/a",
        "http://127.0.0.1/private"
    ]) {
        await assert.rejects(photoImporter()(url));
    }
    assert.equal(fetched.mock.callCount(), 0);
});

test("Google default photos use redirect rejection and signed uploads to return a protected storage asset", async (context) => {
    const fetched = context.mock.method(
        globalThis,
        "fetch",
        async (url: string | URL | Request, init?: RequestInit) => {
            assert.equal(init?.redirect, "error");
            assert.ok(init?.signal);
            if (String(url).startsWith("https://lh3.googleusercontent.com/"))
                return new Response(new Uint8Array([1, 2, 3]), { headers: { "content-type": "image/jpeg" } });
            assert.equal(String(url), "https://upload.example.test/image");
            assert.equal(init?.method, "POST");
            const form = init?.body as FormData;
            assert.equal(form.get("signature"), "server-signature");
            const file = form.get("file") as File;
            assert.equal(file.type, "image/jpeg");
            assert.equal(file.size, 3);
            return Response.json({
                public_id: form.get("public_id"),
                bytes: 3,
                format: "jpg",
                created_at: "2026-10-01T12:00:00Z"
            });
        }
    );
    const asset = await photoImporter()(googleUrl);
    assert.ok(asset);
    assert.match(asset.storageKey, /^roamboard\/google-profile\//);
    assert.equal(asset.byteSize, 3);
    assert.equal(asset.format, "jpg");
    assert.equal(asset.createdAt.toISOString(), "2026-10-01T12:00:00.000Z");
    assert.equal(asset.latitude, null);
    assert.equal(fetched.mock.callCount(), 2);
});

test("Google default photos reject failed, empty, nonimage and oversized downloads without uploading", async (context) => {
    const responses = [
        new Response("missing", { status: 404 }),
        new Response("", { headers: { "content-type": "image/png" } }),
        new Response("<html>error</html>", { headers: { "content-type": "text/html" } }),
        new Response(new Uint8Array(10_000_001), { headers: { "content-type": "image/png" } })
    ];
    const fetched = context.mock.method(globalThis, "fetch", async () => responses.shift()!);
    for (let index = 0; index < 4; index += 1) await assert.rejects(photoImporter()(googleUrl));
    assert.equal(fetched.mock.callCount(), 4);
});

test("Google photo redirect failures and upload failures cannot produce a saved asset", async (context) => {
    const redirect = context.mock.method(
        globalThis,
        "fetch",
        async (_url: string | URL | Request, init?: RequestInit) => {
            assert.equal(init?.redirect, "error");
            throw new TypeError("Unexpected redirect");
        }
    );
    await assert.rejects(photoImporter()(googleUrl), /Unexpected redirect/);
    redirect.mock.restore();
    const fetched = context.mock.method(globalThis, "fetch", async (url: string | URL | Request) =>
        String(url).startsWith("https://lh3.googleusercontent.com/")
            ? new Response("image bytes", { headers: { "content-type": "image/jpeg" } })
            : new Response("unavailable", { status: 503 })
    );
    await assert.rejects(photoImporter()(googleUrl), /could not be saved/);
    assert.equal(fetched.mock.callCount(), 2);
});

test("Google photos reject a mismatching uploaded storage key", async (context) => {
    context.mock.method(globalThis, "fetch", async (url: string | URL | Request) =>
        String(url).startsWith("https://lh3.googleusercontent.com/")
            ? new Response("image bytes", { headers: { "content-type": "image/jpeg" } })
            : Response.json({
                  public_id: "another-users-photo",
                  bytes: 10,
                  format: "jpg",
                  created_at: "2026-10-01T12:00:00Z"
              })
    );
    await assert.rejects(photoImporter()(googleUrl), /Invalid saved Google photo/);
});

test("Google photos request a larger source while preserving Google's composition and delivery options", async (context) => {
    const cases: Array<[string, string]> = [
        ["https://lh3.googleusercontent.com/a/photo=s96-c", "https://lh3.googleusercontent.com/a/photo=s1024-c"],
        [
            "https://lh3.googleusercontent.com/a/photo=s64-c-k-no",
            "https://lh3.googleusercontent.com/a/photo=s1024-c-k-no"
        ],
        ["https://lh3.googleusercontent.com/a/s96-c/photo", "https://lh3.googleusercontent.com/a/s1024-c/photo"],
        [googleUrl, googleUrl + "=s1024"],
        [googleUrl + "?sz=96", googleUrl + "?sz=1024"]
    ];
    const requested: string[] = [];
    context.mock.method(globalThis, "fetch", async (url: string | URL | Request, init?: RequestInit) => {
        if (String(url).startsWith("https://lh3.googleusercontent.com/")) {
            requested.push(String(url));
            return new Response("image bytes", { headers: { "content-type": "image/jpeg" } });
        }
        return Response.json({
            public_id: (init?.body as FormData).get("public_id"),
            bytes: 12,
            format: "jpg",
            created_at: "2026-10-01T12:00:00Z"
        });
    });
    for (const [input] of cases) await photoImporter()(input);
    assert.deepEqual(
        requested,
        cases.map(([, expected]) => expected)
    );
});

test("only a verified old Google import is upgraded; custom and already upgraded assets are left alone", async (context) => {
    const fetched: string[] = [];
    context.mock.method(globalThis, "fetch", async (url: string | URL | Request, init?: RequestInit) => {
        fetched.push(String(url));
        return String(url).startsWith("https://lh3.googleusercontent.com/")
            ? new Response("image bytes", { headers: { "content-type": "image/jpeg" } })
            : Response.json({
                  public_id: (init?.body as FormData).get("public_id"),
                  bytes: 12,
                  format: "jpg",
                  created_at: "2026-10-01T12:00:00Z"
              });
    });
    const inspected: string[] = [];
    const importer = photoImporter(async (key) => {
        inspected.push(key);
        return {
            storageKey: key,
            format: "jpg",
            byteSize: 12,
            createdAt: new Date(),
            capturedAt: null,
            latitude: null,
            longitude: null,
            originalFilename: key === "roamboard/old-google" ? "google-profile" : "custom-photo"
        };
    });
    assert.equal(await importer(googleUrl, "roamboard/custom-photo"), null);
    assert.equal(await importer(googleUrl, "roamboard/google-profile/upgraded"), null);
    assert.deepEqual(fetched, []);
    const upgraded = await importer(googleUrl, "roamboard/old-google");
    assert.ok(upgraded);
    assert.match(upgraded.storageKey, /^roamboard\/google-profile\//);
    assert.equal(fetched.length, 2);
    assert.ok(inspected.includes("roamboard/old-google"));
});

test("Google uploads persist cleanup intent before sending bytes, including response timeouts", async (context) => {
    let intent: UploadIntent | undefined;
    let completions = 0;
    const importer = photoImporter(undefined, {
        async createIntent(value) {
            intent = value;
        },
        async completeIntent() {
            completions += 1;
            return 42;
        }
    });
    context.mock.method(globalThis, "fetch", async (url: string | URL | Request, init?: RequestInit) => {
        if (String(url).startsWith("https://lh3.googleusercontent.com/")) {
            return new Response("photo", { headers: { "content-type": "image/jpeg" } });
        }
        assert.ok(intent, "Cleanup intent must already be committed when upload starts");
        assert.equal(intent.storageKey, (init?.body as FormData).get("public_id"));
        assert.equal(intent.userId, "google-user");
        assert.equal(intent.sizeBytes, 5);
        assert.equal(intent.imageId, null);
        throw new Error("Provider saved bytes but response timed out");
    });
    await assert.rejects(importer(googleUrl), /timed out/);
    assert.ok(intent, "An ambiguous upload failure must retain cleanup tracking");
    assert.equal(completions, 0);
});

test("Google upload is never sent when cleanup tracking cannot be persisted", async (context) => {
    const requested: string[] = [];
    context.mock.method(globalThis, "fetch", async (url: string | URL | Request) => {
        requested.push(String(url));
        return new Response("photo", { headers: { "content-type": "image/jpeg" } });
    });
    const importer = photoImporter(undefined, {
        async createIntent() {
            throw new Error("Database unavailable");
        },
        async completeIntent() {
            assert.fail("No completion expected");
        }
    });
    await assert.rejects(importer(googleUrl), /Database unavailable/);
    assert.equal(requested.length, 1);
    assert.match(requested[0]!, /^https:\/\/lh3\.googleusercontent\.com\//);
});

test("Google imports complete their tracked upload before handing the asset to profile saving", async (context) => {
    let intent: UploadIntent | undefined;
    let completed = false;
    context.mock.method(globalThis, "fetch", async (url: string | URL | Request, init?: RequestInit) =>
        String(url).startsWith("https://lh3.googleusercontent.com/")
            ? new Response("photo", { headers: { "content-type": "image/jpeg" } })
            : Response.json({
                  public_id: (init?.body as FormData).get("public_id"),
                  bytes: 5,
                  format: "jpg",
                  created_at: new Date().toISOString()
              })
    );
    const importer = photoImporter(undefined, {
        async createIntent(value) {
            intent = value;
        },
        async completeIntent(value, asset) {
            assert.equal(value, intent);
            assert.equal(asset.storageKey, intent?.storageKey);
            completed = true;
            return 42;
        }
    });
    const asset = await importer(googleUrl);
    assert.ok(completed);
    assert.equal(asset?.storageKey, intent?.storageKey);
});
