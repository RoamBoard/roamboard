import assert from "node:assert/strict";
import test from "node:test";
import { createQuotaService } from "../src/features/quotas/quota.service.js";
import type { QuotaReservationWindow } from "../src/features/quotas/quota.types.js";
import { AppError } from "../src/shared/app-error.js";

test("quota reservation precedes upstream calls and rejects exhausted budgets", async () => {
    const reservations: QuotaReservationWindow[][] = [];
    let calls = 0;
    const service = createQuotaService(
        {
            async reserve(_id, _units, windows) {
                reservations.push(windows);
                return { allowed: reservations.length === 1 };
            }
        },
        [
            {
                id: "test",
                provider: "Test",
                operation: "search",
                windows: [{ period: "hour", limit: 1, timeZone: "UTC" }]
            }
        ],
        () => new Date("2026-10-14T12:35:00Z")
    );
    assert.equal(
        await service.run("test", async () => {
            calls++;
            return "ok";
        }),
        "ok"
    );
    await assert.rejects(
        () =>
            service.run("test", async () => {
                calls++;
            }),
        (error: unknown) => error instanceof AppError && error.statusCode === 429
    );
    assert.equal(calls, 1);
    assert.equal(reservations[0]?.[0]?.startsAt.toISOString(), "2026-10-14T12:00:00.000Z");
    assert.equal(reservations[0]?.[0]?.endsAt.toISOString(), "2026-10-14T13:00:00.000Z");
});

test("Google quota months follow Los Angeles billing time across daylight saving", async () => {
    let windows: QuotaReservationWindow[] = [];
    const service = createQuotaService(
        {
            async reserve(_id, _units, value) {
                windows = value;
                return { allowed: true };
            }
        },
        [
            {
                id: "google",
                provider: "Google",
                operation: "search",
                windows: [{ period: "month", limit: 1, timeZone: "America/Los_Angeles" }]
            }
        ],
        () => new Date("2026-11-15T12:00:00Z")
    );
    await service.reserve("google");
    assert.equal(windows[0]?.startsAt.toISOString(), "2026-11-01T07:00:00.000Z");
    assert.equal(windows[0]?.endsAt.toISOString(), "2026-12-01T08:00:00.000Z");
});

test("failed provider calls still consume a reservation, and invalid units are rejected", async () => {
    let used = 0;
    const service = createQuotaService(
        {
            async reserve(_id, units) {
                used += units;
                return { allowed: true };
            }
        },
        [{ id: "test", provider: "Test", operation: "search", windows: [{ period: "day", limit: 2, timeZone: "UTC" }] }]
    );
    await assert.rejects(() =>
        service.run("test", async () => {
            throw new Error("provider rejected request");
        })
    );
    assert.equal(used, 1);
    await assert.rejects(() => service.reserve("test", 0));
    await assert.rejects(
        () => service.reserve("test", 3),
        (error: unknown) => error instanceof AppError && error.statusCode === 429
    );
    assert.equal(used, 1);
});
