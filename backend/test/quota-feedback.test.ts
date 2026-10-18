import assert from "node:assert/strict";
import test from "node:test";
import request from "supertest";
import { createApp } from "../src/app.js";
import { AppError } from "../src/shared/app-error.js";
import { createQuotaPolicies } from "../src/features/quotas/quota.policies.js";
import { createQuotaService } from "../src/features/quotas/quota.service.js";
import { observeProviderResponse, observeCloudinary } from "../src/features/quotas/quota.feedback.js";
import type { ProviderQuotaSignal, QuotaReservationWindow } from "../src/features/quotas/quota.types.js";
import {
    fetchUnsplash,
    fetchWeather,
    fetchWikipedia,
    searchMapbox
} from "../src/features/destinations/destination.providers.js";
import {
    searchUnsplash,
    searchGooglePlaces,
    reverseMapbox,
    routeMapbox
} from "../src/features/providers/provider.providers.js";
import { searchGeoapify } from "../src/features/providers/provider.geoapify.js";

test("verified calendar billing months and conservative rolling durations are explicit", async () => {
    const reservations: QuotaReservationWindow[][] = [];
    const quota = createQuotaService(
        {
            async reserve(_id, _units, windows) {
                reservations.push(windows);
                return { allowed: true };
            }
        },
        createQuotaPolicies(),
        () => new Date("2026-11-01T00:30:00Z")
    );
    await quota.reserve("google.places_text_search_pro");
    assert.equal(reservations.at(-1)![0]!.startsAt.toISOString(), "2026-10-01T07:00:00.000Z");
    await quota.reserve("mapbox.geocoding");
    assert.equal(reservations.at(-1)![0]!.startsAt.toISOString(), "2026-11-01T00:00:00.000Z");
    await quota.reserve("unsplash.requests");
    assert.equal(reservations.at(-1)![0]!.rolling, true);
    assert.equal(reservations.at(-1)![0]!.limit, 990);
    await quota.reserve("open_meteo.forecast");
    const month = reservations.at(-1)!.find((window) => window.period === "month")!;
    assert.equal(month.endsAt.getTime() - month.startsAt.getTime(), 31 * 86400000);
});

test("Mapbox monthly allowances can be used without artificial daily budgets and still stop at exhaustion", async () => {
    const monthlyLimits = [
        ["mapbox.map_loads", 49500],
        ["mapbox.geocoding", 99000],
        ["mapbox.directions", 99000]
    ] as const;
    const consumed = new Map<string, number>();
    const reservations: Array<{ id: string; windows: QuotaReservationWindow[] }> = [];
    const retryAt = new Date("2026-12-01T00:00:00Z");
    const quota = createQuotaService(
        {
            async reserve(id, units, windows) {
                reservations.push({ id, windows });
                const limit = monthlyLimits.find(([policyId]) => policyId === id)![1];
                const total = (consumed.get(id) ?? 0) + units;
                if (total > limit) return { allowed: false, retryAt };
                consumed.set(id, total);
                return { allowed: true };
            }
        },
        createQuotaPolicies(),
        () => new Date("2026-11-15T12:30:00Z")
    );
    for (const [id, limit] of monthlyLimits) {
        let upstreamCalls = 0;
        assert.equal(await quota.run(id, async () => ++upstreamCalls, limit), 1);
        const reservation = reservations.at(-1)!;
        assert.equal(reservation.id, id);
        assert.deepEqual(
            reservation.windows.map(({ period, limit, timeZone, rolling }) => ({ period, limit, timeZone, rolling })),
            [{ period: "month", limit, timeZone: "UTC", rolling: false }]
        );
        assert.equal(reservation.windows[0]!.startsAt.toISOString(), "2026-11-01T00:00:00.000Z");
        assert.equal(reservation.windows[0]!.endsAt.toISOString(), retryAt.toISOString());
        await assert.rejects(
            () => quota.run(id, async () => ++upstreamCalls),
            (error: unknown) =>
                error instanceof AppError &&
                error.statusCode === 429 &&
                error.code === "PROVIDER_QUOTA_EXHAUSTED" &&
                error.retryAt?.getTime() === retryAt.getTime()
        );
        assert.equal(upstreamCalls, 1, "Exhausted monthly allowance must prevent the provider call");
        const reservationCount = reservations.length;
        await assert.rejects(() => quota.reserve(id, limit + 1), AppError);
        assert.equal(reservations.length, reservationCount, "Oversized operations must fail before repository access");
    }
});

test("Geoapify retains its native daily and per-second limits without an artificial hourly allocation", async () => {
    const reservations: QuotaReservationWindow[][] = [];
    const quota = createQuotaService(
        {
            async reserve(_id, _units, windows) {
                reservations.push(windows);
                return { allowed: true };
            }
        },
        createQuotaPolicies(),
        () => new Date("2026-11-15T12:30:00Z")
    );
    await quota.reserve("geoapify.geocoding", 2);
    assert.deepEqual(
        reservations[0]!.map(({ period, limit, rolling }) => ({ period, limit, rolling })),
        [
            { period: "second", limit: 2, rolling: true },
            { period: "day", limit: 2970, rolling: true }
        ]
    );
    for (const window of reservations[0]!) {
        const expectedDuration = window.period === "second" ? 1000 : 86400000;
        assert.equal(window.endsAt.getTime() - window.startsAt.getTime(), expectedDuration);
    }
    await assert.rejects(
        () => quota.reserve("geoapify.geocoding", 3),
        (error: unknown) => error instanceof AppError && error.statusCode === 429
    );
    assert.equal(reservations.length, 1, "The retained per-second cap must still reject oversized operations");
});

test("removing artificial budgets preserves other providers' existing allowance periods and limits", async () => {
    const reservations = new Map<string, QuotaReservationWindow[]>();
    const quota = createQuotaService(
        {
            async reserve(id, _units, windows) {
                reservations.set(id, windows);
                return { allowed: true };
            }
        },
        createQuotaPolicies(),
        () => new Date("2026-11-15T12:30:00Z")
    );
    const expected = [
        {
            id: "mapbox.search_box",
            windows: [
                ["month", 495, false],
                ["second", 9, true]
            ]
        },
        { id: "unsplash.requests", windows: [["hour", 990, true]] },
        {
            id: "open_meteo.forecast",
            windows: [
                ["minute", 590, true],
                ["hour", 4950, true],
                ["day", 9900, true],
                ["month", 297000, true]
            ]
        },
        { id: "wikipedia.action_api", windows: [["minute", 190, true]] },
        { id: "cloudinary.admin", windows: [["hour", 495, true]] }
    ];
    for (const policy of expected) {
        await quota.reserve(policy.id);
        assert.deepEqual(
            reservations.get(policy.id)!.map(({ period, limit, rolling }) => [period, limit, rolling]),
            policy.windows
        );
    }
});

test("provider headers honor both Retry-After formats, zero remaining and the later reset", async () => {
    const signals: ProviderQuotaSignal[] = [];
    const observe = async (signal: ProviderQuotaSignal) => {
        signals.push(signal);
    };
    const later = new Date(Date.now() + 3600000);
    await assert.rejects(
        () =>
            observeProviderResponse(
                new Response(null, {
                    status: 429,
                    headers: {
                        "Retry-After": "10",
                        "X-Rate-Limit-Reset": String(Math.ceil(later.getTime() / 1000))
                    }
                }),
                observe
            ),
        AppError
    );
    assert.ok(signals.at(-1)!.retryAt!.getTime() >= later.getTime());
    await assert.rejects(
        () =>
            observeProviderResponse(
                new Response(null, {
                    status: 503,
                    headers: {
                        "Retry-After": later.toUTCString()
                    }
                }),
                observe
            ),
        AppError
    );
    assert.equal(signals.at(-1)!.retryAt!.toUTCString(), later.toUTCString());
    await observeProviderResponse(new Response(null, { headers: { "X-Ratelimit-Remaining": "0" } }), observe);
    assert.equal(signals.at(-1)!.exhausted, true);
    await observeProviderResponse(
        new Response(null, { headers: { "Retry-After": "garbage", "X-Ratelimit-Reset": "NaN" } }),
        observe
    );
    assert.equal(signals.at(-1)!.retryAt, undefined);
});

test("all HTTP provider families report rate limits before parsing a response", async (context) => {
    context.mock.method(
        globalThis,
        "fetch",
        async () =>
            new Response("untrusted upstream error", {
                status: 429,
                headers: { "Retry-After": "60" }
            })
    );
    const signals: ProviderQuotaSignal[] = [];
    const observe = async (signal: ProviderQuotaSignal) => {
        signals.push(signal);
    };
    const calls = [
        () => searchMapbox("Paris", 5, "secret", observe),
        () => reverseMapbox(1, 2, "secret", false, observe),
        () =>
            routeMapbox(
                [
                    { latitude: 1, longitude: 2 },
                    { latitude: 2, longitude: 3 }
                ],
                "walking",
                "secret",
                observe
            ),
        () => searchGeoapify("Paris", 5, "secret", undefined, observe),
        () => searchGooglePlaces("Paris", "secret", 5, observe),
        () => searchUnsplash("Paris", "secret", 5, observe),
        () => fetchUnsplash("Paris", "secret", observe),
        () => fetchWeather(1, 2, observe),
        () => fetchWikipedia("Paris", observe)
    ];
    for (const call of calls)
        await assert.rejects(call, (error: unknown) => error instanceof AppError && error.statusCode === 429);
    assert.equal(signals.length, calls.length);
});

test("Cloudinary success exhaustion and SDK 420 errors supply cooldown feedback", async () => {
    const signals: ProviderQuotaSignal[] = [];
    const observe = async (signal: ProviderQuotaSignal) => {
        signals.push(signal);
    };
    const reset = new Date(Date.now() + 3600000).toISOString();
    const result = await observeCloudinary(
        async () => ({ rate_limit_remaining: 0, rate_limit_reset_at: reset }),
        observe
    );
    assert.equal(result.rate_limit_remaining, 0);
    assert.equal(signals[0]!.retryAt!.toISOString(), reset);
    await assert.rejects(
        () =>
            observeCloudinary(async () => {
                throw { http_code: 420 };
            }, observe),
        AppError
    );
    assert.equal(signals[1]!.status, 429);
});

test("anonymous provider calls share a cooldown and return Retry-After without another upstream call", async (context) => {
    const originalKey = process.env.UNSPLASH_ACCESS_KEY;
    process.env.UNSPLASH_ACCESS_KEY = "test-key";
    context.after(() => {
        if (originalKey === undefined) delete process.env.UNSPLASH_ACCESS_KEY;
        else process.env.UNSPLASH_ACCESS_KEY = originalKey;
    });
    const blocks = new Map<string, Date>();
    const quota = createQuotaService(
        {
            async reserve(id) {
                const until = blocks.get(id);
                return { allowed: !until || until.getTime() <= Date.now(), retryAt: until };
            },
            async block(id, until) {
                blocks.set(id, until);
            }
        },
        createQuotaPolicies()
    );
    let upstreamCalls = 0;
    context.mock.method(globalThis, "fetch", async () => {
        upstreamCalls++;
        return new Response(null, { status: 429, headers: { "Retry-After": "120" } });
    });
    const app = createApp({ quotaService: quota });
    const first = await request(app).get("/api/v1/providers/unsplash/search?q=Paris");
    const second = await request(app).get("/api/v1/providers/unsplash/search?q=Paris");
    assert.equal(first.status, 429);
    assert.equal(second.status, 429);
    assert.ok(Number(second.headers["retry-after"]) > 0);
    assert.equal(upstreamCalls, 1);
});

test("a successful last allowance response returns its data but blocks later calls", async () => {
    let blockedUntil: Date | undefined;
    const now = new Date("2026-11-01T12:00:00Z");
    const quota = createQuotaService(
        {
            async reserve() {
                return { allowed: blockedUntil === undefined };
            },
            async block(_id, until) {
                blockedUntil = until;
            }
        },
        createQuotaPolicies(),
        () => now
    );
    assert.equal(
        await quota.run("unsplash.requests", async (observe) => {
            await observe!({ status: 200, exhausted: true });
            return "last result";
        }),
        "last result"
    );
    assert.equal(blockedUntil!.getTime(), now.getTime() + 3600000);
    await assert.rejects(() => quota.reserve("unsplash.requests"), AppError);
});
