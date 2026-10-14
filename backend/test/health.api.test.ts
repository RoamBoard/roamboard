import assert from "node:assert/strict";
import { describe, it } from "node:test";

import request from "supertest";

import { createApp } from "../src/app.js";

describe("GET /health", () => {
    it("reports that the API is healthy", async () => {
        const response = await request(createApp()).get("/health");

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, { status: "ok" });
    });
});
