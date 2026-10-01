import assert from "node:assert/strict";
import test from "node:test";

import { createMemoryQuotaRepository } from "../src/features/quotas/quota.repository.js";
import { createQuotaPolicies } from "../src/features/quotas/quota.policies.js";
import { createQuotaService } from "../src/features/quotas/quota.service.js";
import type { QuotaPolicy } from "../src/features/quotas/quota.types.js";
import { AppError } from "../src/shared/app-error.js";

const fixedNow = new Date("2026-10-01T12:30:00.000Z");

function policy(windows: QuotaPolicy["windows"]): QuotaPolicy {
  return {
    id: "test.api",
    provider: "Test API",
    operation: "test requests",
    unit: "request",
    sourceUrl: "https://example.com/pricing",
    windows,
  };
}

test("never dispatches a provider call beyond the hard limit", async () => {
  const quota = createQuotaService(
    createMemoryQuotaRepository(),
    [policy([{ period: "month", limit: 2, timeZone: "UTC" }])],
    () => fixedNow,
  );
  const dispatched: string[] = [];

  await quota.run("test.api", async () => { dispatched.push("first"); });
  await quota.run("test.api", async () => { dispatched.push("second"); });
  await assert.rejects(
    quota.run("test.api", async () => { dispatched.push("third"); }),
    (error: unknown) => error instanceof AppError && error.statusCode === 429,
  );

  assert.deepEqual(dispatched, ["first", "second"]);
  const status = await quota.status();
  assert.equal(status.policies[0]?.windows[0]?.used, 2);
  assert.equal(status.policies[0]?.windows[0]?.remaining, 0);
});

test("rolls back all windows when one limit would be exceeded", async () => {
  const quota = createQuotaService(
    createMemoryQuotaRepository(),
    [policy([
      { period: "minute", limit: 2, timeZone: "UTC" },
      { period: "day", limit: 1, timeZone: "UTC" },
    ])],
    () => fixedNow,
  );

  await quota.reserve("test.api");
  await assert.rejects(quota.reserve("test.api"), AppError);

  const status = await quota.status();
  assert.equal(status.policies[0]?.windows[0]?.used, 1);
  assert.equal(status.policies[0]?.windows[1]?.used, 1);
});

test("uses a provider timezone for calendar-month resets", async () => {
  const quota = createQuotaService(
    createMemoryQuotaRepository(),
    [policy([{ period: "month", limit: 10, timeZone: "America/Los_Angeles" }])],
    () => new Date("2026-10-01T07:30:00.000Z"),
  );

  const status = await quota.status();
  assert.equal(status.policies[0]?.windows[0]?.startsAt, "2026-10-01T07:00:00.000Z");
  assert.equal(status.policies[0]?.windows[0]?.resetsAt, "2026-11-01T07:00:00.000Z");
});

test("counts failed upstream calls conservatively", async () => {
  const quota = createQuotaService(
    createMemoryQuotaRepository(),
    [policy([{ period: "month", limit: 1, timeZone: "UTC" }])],
    () => fixedNow,
  );

  await assert.rejects(quota.run("test.api", async () => { throw new Error("upstream failed"); }), /upstream failed/);
  await assert.rejects(quota.reserve("test.api"), AppError);
});

test("reviewed provider caps stay below their published free boundaries", () => {
  const policies = createQuotaPolicies();
  assert.equal(policies.find((candidate) => candidate.id === "mapbox.geocoding")?.windows[0]?.limit, 99_000);
  assert.equal(policies.find((candidate) => candidate.id === "google.place_details_essentials")?.windows[0]?.limit, 9_900);
  assert.equal(policies.find((candidate) => candidate.id === "unsplash.requests")?.windows[0]?.limit, 990);
});
