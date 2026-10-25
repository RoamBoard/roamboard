import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import express from "express";
import request from "supertest";
import { createProviderService } from "../src/features/providers/provider.service.js";
import { createProviderController } from "../src/features/providers/provider.controller.js";
import { createProviderRouter } from "../src/features/providers/provider.routes.js";
import { errorHandler } from "../src/middleware/error-handler.js";
import { AppError } from "../src/shared/app-error.js";

const searchPath = "/api/v1/providers/unsplash/activity-search";
const selectPath = "/api/v1/providers/unsplash/activity-photos/select";
const origin = "http://localhost:3000";
function canonicalPhoto(id = "red_boat-1") {
    return {
        id,
        alt_description: "A red sailing boat",
        width: 1600,
        height: 2400,
        urls: {
            regular: `https://images.unsplash.com/${id}?ixid=canonical`,
            small: `https://images.unsplash.com/${id}?ixid=canonical&w=400`
        },
        user: { name: "Actual Photographer", links: { html: "https://unsplash.com/@actual" } },
        links: {
            html: `https://unsplash.com/photos/${id}`,
            download_location: `https://api.unsplash.com/photos/${id}/download?ixid=canonical`
        }
    };
}
function setup(context: TestContext, quotaError?: AppError) {
    const oldKey = process.env.UNSPLASH_ACCESS_KEY;
    process.env.UNSPLASH_ACCESS_KEY = "manual-search-test-key";
    context.after(() => {
        if (oldKey === undefined) delete process.env.UNSPLASH_ACCESS_KEY;
        else process.env.UNSPLASH_ACCESS_KEY = oldKey;
    });
    const reservations: string[] = [];
    const service = createProviderService(
        {
            async reserve(policy) {
                reservations.push(policy);
                if (quotaError) throw quotaError;
            },
            async run(policy, operation) {
                reservations.push(policy);
                if (quotaError) throw quotaError;
                return operation();
            }
        },
        {
            async save() {
                throw new Error("unused");
            },
            async list() {
                return [];
            },
            async delete() {
                return false;
            }
        }
    );
    const app = express();
    app.use(express.json());
    app.use(
        "/api/v1/providers",
        createProviderRouter(createProviderController(service), (req, res, next) => {
            if (req.headers["x-test-user"] === "owner") res.locals.user = { userId: "owner" };
            next();
        })
    );
    app.use(errorHandler);
    return { api: request(app), reservations };
}

test("manual photo endpoints authenticate and validate before spending provider requests", async (context) => {
    const fetched: unknown[] = [];
    context.mock.method(globalThis, "fetch", async (input: unknown) => {
        fetched.push(input);
        return Response.json({});
    });
    const { api, reservations } = setup(context);
    assert.equal((await api.get(searchPath).query({ q: "red boat" })).status, 401);
    assert.equal((await api.post(selectPath).set("Origin", origin).send({ photoId: "boat" })).status, 401);
    for (const suppliedOrigin of [undefined, "https://wrong.example", origin + ".evil.example"]) {
        const call = api.post(selectPath).set("x-test-user", "owner");
        if (suppliedOrigin) call.set("Origin", suppliedOrigin);
        assert.equal((await call.send({ photoId: "boat" })).status, 403);
    }
    for (const query of [
        { q: " " },
        { q: "x".repeat(161) },
        { q: "boat", page: 0 },
        { q: "boat", page: 1.5 },
        { q: "boat", page: "9007199254740992" }
    ]) {
        assert.equal((await api.get(searchPath).set("x-test-user", "owner").query(query)).status, 400);
    }
    for (const body of [
        {},
        { photoId: "https://evil.example/photo" },
        { photoId: "../secret" },
        { photoId: "boat", url: "https://evil.example" }
    ]) {
        assert.equal(
            (await api.post(selectPath).set("x-test-user", "owner").set("Origin", origin).send(body)).status,
            400
        );
    }
    assert.deepEqual(reservations, []);
    assert.deepEqual(fetched, []);
});

test("explicit manual searches retain exact words, paginate twelve all-orientation photos and never select", async (context) => {
    const urls: URL[] = [];
    context.mock.method(globalThis, "fetch", async (input: string | URL) => {
        urls.push(new URL(input));
        return Response.json({ total: 31, total_pages: 3, results: [canonicalPhoto()] });
    });
    const { api, reservations } = setup(context);
    const response = await api
        .get(searchPath)
        .set("x-test-user", "owner")
        .query({ q: "  red sailing boat  ", page: 2 });
    assert.equal(response.status, 200);
    assert.deepEqual(
        {
            query: response.body.data.query,
            page: response.body.data.page,
            pageSize: response.body.data.pageSize,
            total: response.body.data.total,
            totalPages: response.body.data.totalPages
        },
        { query: "red sailing boat", page: 2, pageSize: 12, total: 31, totalPages: 3 }
    );
    assert.equal(response.body.data.photos[0].id, "red_boat-1");
    assert.equal(response.body.data.photos[0].height, 2400, "Portrait photographs must remain eligible");
    assert.equal(urls.length, 1);
    assert.ok(urls[0]);
    assert.equal(urls[0].pathname, "/search/photos");
    assert.equal(urls[0].searchParams.get("query"), "red sailing boat");
    assert.equal(urls[0].searchParams.get("page"), "2");
    assert.equal(urls[0].searchParams.get("per_page"), "12");
    assert.equal(urls[0].searchParams.has("orientation"), false);
    assert.deepEqual(reservations, ["unsplash.requests"]);
});

test("manual selection accepts an unrelated canonical photo, retains credit and records its canonical download once", async (context) => {
    const urls: URL[] = [];
    context.mock.method(globalThis, "fetch", async (input: string | URL) => {
        const url = new URL(input);
        urls.push(url);
        return Response.json(
            url.pathname.endsWith("/download") ? { url: "https://images.unsplash.com/original" } : canonicalPhoto()
        );
    });
    const { api, reservations } = setup(context);
    const response = await api
        .post(selectPath)
        .set("x-test-user", "owner")
        .set("Origin", origin)
        .send({ photoId: "red_boat-1" });
    assert.equal(response.status, 200);
    assert.equal(response.body.data.id, "red_boat-1");
    assert.equal(response.body.data.photographer, "Actual Photographer");
    assert.match(response.body.data.url, /^https:\/\/images\.unsplash\.com\//);
    assert.equal(response.body.data.context, null, "Manual selection must not claim geographic verification");
    assert.deepEqual(
        urls.map((url) => url.pathname),
        ["/photos/red_boat-1", "/photos/red_boat-1/download"]
    );
    assert.deepEqual(reservations, ["unsplash.requests", "unsplash.requests"]);
});

test("selection rejects mismatched identity and hostile provider links without recording a download", async (context) => {
    const calls: URL[] = [];
    const value = { photo: canonicalPhoto() };
    context.mock.method(globalThis, "fetch", async (input: string | URL) => {
        calls.push(new URL(input));
        return Response.json(value.photo);
    });
    const { api } = setup(context);
    for (const photo of [
        canonicalPhoto("wrong-id"),
        {
            ...canonicalPhoto(),
            urls: { regular: "https://evil.example/photo", small: "https://images.unsplash.com/thumb" }
        },
        { ...canonicalPhoto(), links: { ...canonicalPhoto().links, download_location: "https://evil.example/collect" } }
    ]) {
        value.photo = photo;
        const response = await api
            .post(selectPath)
            .set("x-test-user", "owner")
            .set("Origin", origin)
            .send({ photoId: "red_boat-1" });
        assert.ok([404, 502, 503].includes(response.status));
    }
    assert.equal(calls.length, 3);
    assert.ok(calls.every((url) => url.hostname === "api.unsplash.com" && !url.pathname.endsWith("/download")));
});

test("manual search and selection expose safe quota/provider failures without fabricated photos", async (context) => {
    const quota = setup(
        context,
        new AppError(429, "Photo search is temporarily limited.", "QUOTA_EXCEEDED", new Date(Date.now() + 60000))
    );
    const limited = await quota.api.get(searchPath).set("x-test-user", "owner").query({ q: "boats" });
    assert.equal(limited.status, 429);
    assert.ok(Number(limited.headers["retry-after"]) > 0);
    context.mock.method(globalThis, "fetch", async () =>
        Response.json({ secret: "upstream-sensitive-body" }, { status: 503 })
    );
    const provider = setup(context);
    const failed = await provider.api.get(searchPath).set("x-test-user", "owner").query({ q: "boats" });
    assert.ok([502, 503].includes(failed.status));
    assert.doesNotMatch(JSON.stringify(failed.body), /manual-search-test-key|upstream-sensitive-body/);
    assert.equal(failed.body.data, undefined);
});
