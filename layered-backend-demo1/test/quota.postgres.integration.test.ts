import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

import express from "express";
import { Pool } from "pg";
import request from "supertest";

import { env } from "../src/config/env.js";
import { createProviderModule } from "../src/features/providers/provider.module.js";
import { createPostgresQuotaRepository } from "../src/features/quotas/quota.postgres-repository.js";
import { createQuotaService } from "../src/features/quotas/quota.service.js";
import type { QuotaPolicy, QuotaReservationWindow } from "../src/features/quotas/quota.types.js";
import { errorHandler } from "../src/middleware/error-handler.js";

const runIntegration = process.env.RUN_POSTGRES_INTEGRATION === "1";

test(
    "PostgreSQL quota reservations and map sessions enforce durable hard limits",
    { skip: !runIntegration },
    async (context) => {
        const databaseUrl = process.env.TEST_DATABASE_URL;
        assert.ok(databaseUrl, "Set TEST_DATABASE_URL for the PostgreSQL integration test");
        const schema = `quota_test_${randomUUID().replaceAll("-", "")}`;
        const admin = new Pool({ connectionString: databaseUrl });
        const pool = new Pool({ connectionString: databaseUrl, options: `-c search_path=${schema}` });
        const originalToken = env.MAPBOX_PUBLIC_TOKEN;
        const now = new Date();
        const window = (name: string, limit: number): QuotaReservationWindow => ({
            name,
            limit,
            period: "day",
            timeZone: "UTC",
            startsAt: now,
            endsAt: new Date(now.getTime() + 86_400_000)
        });

        try {
            await admin.query(`CREATE SCHEMA ${schema}`);
            await pool.query(await readFile(resolve("migrations/002_api_quota_usage.sql"), "utf8"));
            const repository = createPostgresQuotaRepository(pool);

            await context.test("first reservation is blocked at zero and leaves no counter", async () => {
                const windows = [window("zero", 0)];
                const result = await repository.reserve("zero", 1, windows);
                assert.equal(result.allowed, false);
                assert.equal(result.blocked?.used, 0);
                assert.deepEqual(await repository.usage("zero", windows), [0]);
                const rows = await pool.query(
                    "SELECT count(*)::int AS count FROM api_quota_usage WHERE policy_id = $1",
                    ["zero"]
                );
                assert.equal(rows.rows[0].count, 0);
            });

            await context.test("first insert and subsequent updates stop exactly at the limit", async () => {
                const windows = [window("positive", 3)];
                assert.equal((await repository.reserve("positive", 1, windows)).allowed, true);
                assert.deepEqual(await repository.usage("positive", windows), [1]);
                assert.equal((await repository.reserve("positive", 2, windows)).allowed, true);
                const blocked = await repository.reserve("positive", 1, windows);
                assert.equal(blocked.allowed, false);
                assert.equal(blocked.blocked?.used, 3);
                assert.deepEqual(await createPostgresQuotaRepository(pool).usage("positive", windows), [3]);
            });

            await context.test("a blocked later window rolls back the earlier window", async () => {
                const windows = [window("first", 10), window("second", 1)];
                assert.equal((await repository.reserve("transaction", 1, windows)).allowed, true);
                assert.equal((await repository.reserve("transaction", 1, windows)).allowed, false);
                assert.deepEqual(await repository.usage("transaction", windows), [1, 1]);
            });

            await context.test("concurrent reservations cannot exceed the cap", async () => {
                const windows = [window("concurrent", 7)];
                const attempts = await Promise.all(
                    Array.from({ length: 20 }, () => repository.reserve("concurrent", 1, windows))
                );
                assert.equal(attempts.filter((attempt) => attempt.allowed).length, 7);
                assert.deepEqual(await repository.usage("concurrent", windows), [7]);
            });

            await context.test(
                "map-session HTTP succeeds with PostgreSQL and returns 429 at its durable cap",
                async () => {
                    env.MAPBOX_PUBLIC_TOKEN = "pk.integration-test-public-token";
                    const policy: QuotaPolicy = {
                        id: "mapbox.map_loads",
                        provider: "Mapbox",
                        operation: "map initialization",
                        unit: "map load",
                        sourceUrl: "https://www.mapbox.com/pricing",
                        windows: [{ period: "day", timeZone: "UTC", limit: 2 }]
                    };
                    const app = () => {
                        const instance = express();
                        const quota = createQuotaService(createPostgresQuotaRepository(pool), [policy], () => now);
                        instance.use("/api/v1/providers", createProviderModule(quota).router);
                        instance.use(errorHandler);
                        return instance;
                    };
                    const response = await request(app()).post("/api/v1/providers/mapbox/map-session").expect(200);
                    assert.equal(response.body.data.publicToken, "pk.integration-test-public-token");
                    await request(app()).post("/api/v1/providers/mapbox/map-session").expect(200);
                    const blocked = await request(app()).post("/api/v1/providers/mapbox/map-session").expect(429);
                    assert.equal(blocked.body.error.details.code, "PROVIDER_QUOTA_EXHAUSTED");
                    assert.equal(blocked.body.error.details.window.used, 2);
                    const status = await createQuotaService(
                        createPostgresQuotaRepository(pool),
                        [policy],
                        () => now
                    ).status();
                    assert.equal(status.durable, true);
                    assert.equal(status.policies[0]?.windows[0]?.used, 2);
                }
            );
        } finally {
            env.MAPBOX_PUBLIC_TOKEN = originalToken;
            await pool.end();
            // Only the random schema created by this test is removed.
            await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
            await admin.end();
        }
    }
);
