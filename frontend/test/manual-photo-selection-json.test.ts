import assert from "node:assert/strict";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { createRequire } from "node:module";
import test from "node:test";
import { selectManualActivityPhoto } from "../src/lib/providers";

test("manual photo selection sends JSON that the real Express application/json parser can read", async (context) => {
    const backendModules = createRequire(new URL("../../backend/package.json", import.meta.url));
    const express = backendModules("express");
    const app = express();
    const received: Array<{ contentType: string | undefined; body: unknown }> = [];
    const canonical = {
        id: "selected-photo",
        url: "https://images.unsplash.com/selected-photo?ixid=canonical",
        context: null
    };
    app.use(express.json());
    app.post(
        "/api/v1/providers/unsplash/activity-photos/select",
        (req: IncomingMessage & { body?: unknown }, res: ServerResponse) => {
            received.push({ contentType: req.headers["content-type"], body: req.body });
            res.setHeader("Content-Type", "application/json");
            if (
                !req.body ||
                typeof req.body !== "object" ||
                !("photoId" in req.body) ||
                req.body.photoId !== "selected-photo"
            ) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: { code: "INVALID_REQUEST", message: "A JSON photoId is required." } }));
                return;
            }
            res.end(JSON.stringify({ data: canonical }));
        }
    );
    const server = createServer(app);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    context.after(
        () => new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))
    );
    const address = server.address();
    assert.ok(address && typeof address === "object");
    const actualFetch = globalThis.fetch;
    const requests: RequestInit[] = [];
    context.mock.method(globalThis, "fetch", (input: string | URL | Request, init?: RequestInit) => {
        assert.ok(init);
        requests.push(init);
        return actualFetch(`http://127.0.0.1:${address.port}${new URL(String(input)).pathname}`, init);
    });
    const selected = await selectManualActivityPhoto("selected-photo");
    assert.deepEqual(selected, canonical);
    assert.deepEqual(received, [{ contentType: "application/json", body: { photoId: "selected-photo" } }]);
    assert.equal(requests.length, 1);
    assert.equal(requests[0].credentials, "include");
});
