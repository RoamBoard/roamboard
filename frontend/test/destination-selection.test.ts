import assert from "node:assert/strict";
import test from "node:test";
import DestinationRoute, { generateMetadata } from "../src/app/discover/destinations/[slug]/page";
import {
    destinationSearchHref,
    destinationSelectionMatches,
    resolveDestinationSearchHref
} from "../src/lib/destination-search";
import type { Destination } from "../src/lib/destinations";

type Selection = Record<string, string | string[] | undefined>;
const paris = { countryCode: "FRA", coordinates: { latitude: 48.8566, longitude: 2.3522 } };
const valid: Selection = { country: "FRA", id: "mapbox:paris", type: "place", lat: "48.8566", lon: "2.3522" };

function destination(overrides: Partial<Destination> = {}): Destination {
    return {
        id: "mapbox:paris",
        name: "Paris",
        address: "Paris, France",
        latitude: 48.8566,
        longitude: 2.3522,
        countryCode: "FRA",
        country: "France",
        city: "Paris",
        placeType: "place",
        context: [],
        ...overrides
    };
}

test("a primary city has a clean URL while a same-country namesake retains its precise identity", () => {
    const maine = destination({
        id: "portland-maine",
        name: "Portland",
        countryCode: "USA",
        latitude: 43.6591,
        longitude: -70.2568
    });
    const oregon = destination({
        id: "portland-oregon",
        name: "Portland",
        countryCode: "USA",
        latitude: 45.5152,
        longitude: -122.6784
    });
    const first = new URL(destinationSearchHref(maine, oregon), "https://roamboard.test");
    const second = new URL(destinationSearchHref(oregon, oregon), "https://roamboard.test");
    assert.equal(first.pathname, "/discover/destinations/portland");
    assert.equal(second.pathname, first.pathname);
    assert.notEqual(first.href, second.href);
    assert.equal(second.search, "");
    assert.deepEqual(Object.fromEntries(first.searchParams), {
        country: "USA",
        id: maine.id,
        type: "place",
        lat: String(maine.latitude),
        lon: String(maine.longitude)
    });
    const unknownCountry = new URL(destinationSearchHref(destination({ countryCode: null })), "https://roamboard.test");
    assert.equal(unknownCountry.searchParams.has("country"), true);
    assert.equal(unknownCountry.searchParams.get("country"), "");
});

test("city guide aliases require the correct country, city type and nearby coordinates", () => {
    const local = destination({
        name: "København",
        city: "København",
        countryCode: "DNK",
        latitude: 55.6761,
        longitude: 12.5683
    });
    const path = (selected: Destination) => new URL(destinationSearchHref(selected), "https://roamboard.test").pathname;
    assert.equal(path(local), "/discover/destinations/copenhagen");
    for (const selected of [
        { ...local, countryCode: "USA" },
        { ...local, placeType: "region" },
        { ...local, latitude: 57.0488, longitude: 9.9217 }
    ])
        assert.equal(path(selected), "/discover/destinations/k%C3%B8benhavn");
});

test("selection validation accepts legacy links and nearby cities but rejects foreign or distant namesakes", () => {
    assert.equal(destinationSelectionMatches(paris, "place", {}), true);
    assert.equal(destinationSelectionMatches(paris, "place", { chapter: "atlas" }), true);
    assert.equal(destinationSelectionMatches(paris, "place", { country: "FRA" }), true);
    assert.equal(destinationSelectionMatches(paris, "place", { country: "USA" }), false);
    assert.equal(destinationSelectionMatches(paris, "place", valid), true);
    assert.equal(destinationSelectionMatches(paris, "place", { ...valid, lat: "48.95" }), true);
    assert.equal(destinationSelectionMatches(paris, "place", { ...valid, lat: "49.2" }), false);
    assert.equal(
        destinationSelectionMatches(paris, "place", { ...valid, country: "USA", lat: "33.6609", lon: "-95.5555" }),
        false
    );
    assert.equal(destinationSelectionMatches(paris, "place", { ...valid, lat: "45.764", lon: "4.8357" }), false);
    assert.equal(
        destinationSelectionMatches(
            { countryCode: "JPN", coordinates: { latitude: 35.0116, longitude: 135.7681 } },
            "place",
            { ...valid, country: "JPN", type: "region", lat: "35.0116", lon: "135.7681" }
        ),
        false
    );
    assert.equal(
        destinationSelectionMatches({ countryCode: "FRA" }, "country", {
            ...valid,
            type: "country",
            lat: "43.3",
            lon: "5.4"
        }),
        true
    );
    assert.equal(destinationSelectionMatches({ countryCode: "FRA" }, "country", valid), false);
});

test("partial, repeated, malformed and out-of-range selection identities cannot match a guide", () => {
    const invalid: Selection[] = [
        { id: "mapbox:paris" },
        { country: "FR" },
        { country: "ZZZ" },
        { country: ["FRA", "FRA"] },
        { country: "" },
        { lat: "48.8566" },
        { lon: "2.3522" },
        { type: "place" },
        { ...valid, id: "" },
        { ...valid, id: " " },
        { ...valid, country: "FR" },
        { ...valid, country: "ZZZ" },
        { ...valid, lat: "" },
        { ...valid, lon: " " },
        { ...valid, lat: "NaN" },
        { ...valid, lon: "Infinity" },
        { ...valid, lat: "91" },
        { ...valid, lon: "-181" },
        { ...valid, lat: "48.8566oops" },
        ...Object.keys(valid).map((key) => ({ ...valid, [key]: [String(valid[key]), String(valid[key])] }))
    ];
    for (const selection of invalid)
        assert.equal(destinationSelectionMatches(paris, "place", selection), false, JSON.stringify(selection));
});

test("the real city route and metadata reject mismatched selections while keeping legacy and correct Paris links", async () => {
    const params = Promise.resolve({ slug: "paris" });
    assert.ok(await DestinationRoute({ params }));
    assert.match(String((await generateMetadata({ params })).title), /Paris/);
    assert.ok(await DestinationRoute({ params, searchParams: Promise.resolve({ country: "FRA" }) }));
    assert.match(
        String((await generateMetadata({ params, searchParams: Promise.resolve({ country: "FRA" }) })).title),
        /Paris/
    );
    assert.ok(await DestinationRoute({ params, searchParams: Promise.resolve(valid) }));
    assert.match(String((await generateMetadata({ params, searchParams: Promise.resolve(valid) })).title), /Paris/);
    for (const selection of [
        { country: "USA" },
        { ...valid, country: "USA", lat: "33.6609", lon: "-95.5555" },
        { ...valid, type: "region" },
        { ...valid, lat: "45.764", lon: "4.8357" },
        { id: "partial" },
        { ...valid, id: ["one", "two"] },
        { ...valid, lat: "NaN" }
    ]) {
        const props = { params, searchParams: Promise.resolve(selection) };
        await assert.rejects(DestinationRoute(props), /404/);
        await assert.rejects(generateMetadata(props), /404/);
    }
    const kyoto = {
        params: Promise.resolve({ slug: "kyoto" }),
        searchParams: Promise.resolve({ ...valid, country: "JPN", type: "region", lat: "35.0116", lon: "135.7681" })
    };
    await assert.rejects(DestinationRoute(kyoto), /404/);
    await assert.rejects(generateMetadata(kyoto), /404/);
});

test("country route metadata accepts a selected country and both route surfaces reject city or foreign identities", async () => {
    const params = Promise.resolve({ slug: "france" });
    const selected = { ...valid, type: "country", lat: "43.3", lon: "5.4" };
    assert.match(String((await generateMetadata({ params, searchParams: Promise.resolve(selected) })).title), /France/);
    assert.match(
        String((await generateMetadata({ params, searchParams: Promise.resolve({ country: "FRA" }) })).title),
        /France/
    );
    assert.equal(
        destinationSearchHref(destination({ name: "France", city: null, placeType: "country" })),
        "/discover/destinations/france"
    );
    for (const selection of [valid, { country: "USA" }, { ...selected, country: "USA" }, { ...selected, lon: "181" }]) {
        const props = { params, searchParams: Promise.resolve(selection) };
        await assert.rejects(DestinationRoute(props), /404/);
        await assert.rejects(generateMetadata(props), /404/);
    }
});

test("a generated Paris namesake search URL cannot mount the France guide or return its metadata", async () => {
    for (const selected of [
        destination({
            id: "mapbox:paris-texas",
            country: "United States",
            countryCode: "USA",
            latitude: 33.6609,
            longitude: -95.5555
        }),
        destination({ id: "mapbox:distant-paris-france", latitude: 45.764, longitude: 4.8357 })
    ]) {
        const url = new URL(destinationSearchHref(selected), "https://roamboard.test");
        assert.equal(url.pathname, "/discover/destinations/paris");
        const props = {
            params: Promise.resolve({ slug: url.pathname.split("/").at(-1)! }),
            searchParams: Promise.resolve(Object.fromEntries(url.searchParams))
        };
        await assert.rejects(DestinationRoute(props), /404/);
        await assert.rejects(generateMetadata(props), /404/);
    }
    const url = new URL(destinationSearchHref(destination()), "https://roamboard.test");
    const props = {
        params: Promise.resolve({ slug: url.pathname.split("/").at(-1)! }),
        searchParams: Promise.resolve(Object.fromEntries(url.searchParams))
    };
    assert.ok(await DestinationRoute(props));
    assert.match(String((await generateMetadata(props)).title), /Paris/);
});

test("editorial Paris uses a clean URL and Paris Texas needs only a country without a provider lookup", async (context) => {
    context.mock.method(globalThis, "fetch", async () => {
        assert.fail("Existing guides must not need a primary-destination lookup");
    });
    assert.equal(
        await resolveDestinationSearchHref(destination(), "Par", [destination()]),
        "/discover/destinations/paris"
    );
    const texas = destination({ id: "paris-texas", countryCode: "USA", latitude: 33.6609, longitude: -95.5555 });
    assert.equal(
        await resolveDestinationSearchHref(texas, "Paris Texas", [texas]),
        "/discover/destinations/paris?country=USA"
    );
});

test("the screenshot's opaque Mapbox Paris identity produces a clean search URL without rewriting legacy arrivals", async (context) => {
    context.mock.method(globalThis, "fetch", async () => {
        assert.fail("Recognizing the existing Paris guide does not require another provider request");
    });
    const selected = destination({ id: "dXJuOm1ieHBsYzpEYVJO", latitude: 48.853495, longitude: 2.348392 });
    assert.equal(destinationSearchHref(selected), "/discover/destinations/paris");
    assert.equal(await resolveDestinationSearchHref(selected, "Par", [selected]), "/discover/destinations/paris");
    const props = {
        params: Promise.resolve({ slug: "paris" }),
        searchParams: Promise.resolve({
            country: "FRA",
            id: selected.id,
            type: "place",
            lat: "48.853495",
            lon: "2.348392"
        })
    };
    assert.ok(await DestinationRoute(props));
    assert.match(String((await generateMetadata(props)).title), /Paris/);
});

test("existing valid guide links with unrelated and repeated parameters render without redirects", async () => {
    const params = Promise.resolve({ slug: "paris" });
    const searchParams = Promise.resolve({
        ...valid,
        campaign: "test",
        chapter: ["food", "art"],
        empty: "",
        absent: undefined
    });
    assert.ok(await DestinationRoute({ params, searchParams }));
    assert.match(String((await generateMetadata({ params, searchParams })).title), /Paris/);
    assert.ok(
        await DestinationRoute({
            params,
            searchParams: Promise.resolve({ campaign: "test", chapter: ["food", "art"], empty: "" })
        })
    );
    assert.ok(await DestinationRoute({ params }));
});

const lagosNigeria = destination({
    id: "lagos-nigeria",
    name: "Lagos",
    country: "Nigeria",
    countryCode: "NGA",
    latitude: 6.455,
    longitude: 3.384
});
const lagosPortugal = destination({
    id: "lagos-portugal",
    name: "Lagos",
    country: "Portugal",
    countryCode: "PRT",
    latitude: 37.102,
    longitude: -8.674
});

const stockholm = destination({
    id: "dXJuOm1ieHBsYzpTdG9ja2hvbG0",
    name: "Stockholm",
    city: "Stockholm",
    country: "Sweden",
    countryCode: "SWE",
    latitude: 59.324337,
    longitude: 18.06902
});

test("Stockholm creates a clean URL directly without requiring an existing guide", async (context) => {
    context.mock.method(globalThis, "fetch", async () => {
        assert.fail("An exact search already has its primary result");
    });
    assert.equal(destinationSearchHref(stockholm), "/discover/destinations/stockholm");
    assert.equal(
        await resolveDestinationSearchHref(stockholm, "Stockholm", [stockholm]),
        "/discover/destinations/stockholm"
    );
    const props = { params: Promise.resolve({ slug: "stockholm" }) };
    await assert.rejects(DestinationRoute(props), /404/);
    await assert.rejects(generateMetadata(props), /404/);
});

for (const outcome of ["primary", "nearby-provider-identity", "empty", "network", "provider"] as const) {
    test(`a Stockholm prefix selection navigates cleanly when its primary lookup returns ${outcome}`, async (context) => {
        const requests: URL[] = [];
        context.mock.method(globalThis, "fetch", async (input: string | URL | Request) => {
            requests.push(new URL(String(input)));
            if (outcome === "network") throw new TypeError("Offline");
            if (outcome === "provider") return Response.json({ error: { message: "Unavailable" } }, { status: 503 });
            const primary =
                outcome === "nearby-provider-identity"
                    ? { ...stockholm, id: "another-provider-id", latitude: 59.33, longitude: 18.07 }
                    : stockholm;
            return Response.json({ data: outcome === "empty" ? [] : [primary] });
        });
        assert.equal(
            await resolveDestinationSearchHref(stockholm, "Stock", [stockholm]),
            "/discover/destinations/stockholm"
        );
        assert.equal(requests.length, 1);
        assert.equal(requests[0].searchParams.get("q"), "Stockholm");
    });
}

test("an unqualified search reuses Mapbox's first result as the clean primary, qualifying foreign namesakes", async (context) => {
    context.mock.method(globalThis, "fetch", async () => {
        assert.fail("An exact unqualified query already establishes Mapbox's primary result");
    });
    const results = [lagosNigeria, lagosPortugal];
    assert.equal(await resolveDestinationSearchHref(lagosNigeria, "Lagos", results), "/discover/destinations/lagos");
    assert.equal(
        await resolveDestinationSearchHref(lagosPortugal, "Lagos", results),
        "/discover/destinations/lagos?country=PRT"
    );
});

test("a qualified or prefix query resolves the unqualified Mapbox primary before assigning its URL", async (context) => {
    const requests: URL[] = [];
    context.mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
        const url = new URL(String(input));
        requests.push(url);
        assert.equal(url.pathname, "/api/v1/destinations/search");
        assert.equal(url.searchParams.get("q"), "Lagos");
        assert.equal(url.searchParams.get("limit"), "3");
        assert.equal(init?.credentials, "include");
        return Response.json({ data: [lagosNigeria, lagosPortugal] });
    });
    assert.equal(
        await resolveDestinationSearchHref(lagosPortugal, "Lagos Portugal", [lagosPortugal]),
        "/discover/destinations/lagos?country=PRT"
    );
    assert.equal(requests.length, 1);
    assert.equal(
        await resolveDestinationSearchHref(lagosNigeria, "Lag", [lagosNigeria]),
        "/discover/destinations/lagos"
    );
    assert.equal(requests.length, 2);
});

test("an exact secondary Portland preserves its identity when both cities share a country", async (context) => {
    context.mock.method(globalThis, "fetch", async () => {
        assert.fail("An exact query does not need another lookup");
    });
    const oregon = destination({
        id: "portland-oregon",
        name: "Portland",
        countryCode: "USA",
        latitude: 45.5152,
        longitude: -122.6784
    });
    const maine = destination({
        id: "portland-maine",
        name: "Portland",
        countryCode: "USA",
        latitude: 43.6591,
        longitude: -70.2568
    });
    assert.equal(
        await resolveDestinationSearchHref(oregon, "Portland", [oregon, maine]),
        "/discover/destinations/portland"
    );
    const secondary = new URL(
        await resolveDestinationSearchHref(maine, "Portland", [oregon, maine]),
        "https://roamboard.test"
    );
    assert.deepEqual(Object.fromEntries(secondary.searchParams), {
        country: "USA",
        id: "portland-maine",
        type: "place",
        lat: "43.6591",
        lon: "-70.2568"
    });
});

test("aborting navigation cancels and settles a pending primary lookup even when fetch ignores its signal", async (context) => {
    const controller = new AbortController();
    const requests: AbortSignal[] = [];
    context.mock.method(globalThis, "fetch", (_input: string | URL | Request, init?: RequestInit) => {
        assert.ok(init?.signal);
        requests.push(init.signal);
        return new Promise<Response>(() => {});
    });
    const settled: string[] = [];
    void resolveDestinationSearchHref(lagosPortugal, "Lagos Portugal", [lagosPortugal], controller.signal).then(
        (href) => {
            settled.push(href);
        }
    );
    assert.equal(requests.length, 1);
    assert.equal(requests[0].aborted, false);
    controller.abort();
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(requests[0].aborted, true);
    assert.deepEqual(settled, ["/discover/destinations/lagos"]);
});

test("an already cancelled navigation does not start a primary API lookup", async (context) => {
    const controller = new AbortController();
    controller.abort();
    const requests: number[] = [];
    context.mock.method(globalThis, "fetch", async () => {
        requests.push(1);
        return Response.json({ data: [lagosNigeria] });
    });
    assert.equal(
        await resolveDestinationSearchHref(lagosPortugal, "Lagos Portugal", [lagosPortugal], controller.signal),
        "/discover/destinations/lagos"
    );
    assert.equal(requests.length, 0);
});

for (const lateOutcome of ["success", "failure"] as const) {
    test(`a stalled primary lookup settles after one second and ignores late ${lateOutcome}`, async (context) => {
        context.mock.timers.enable({ apis: ["setTimeout"] });
        const pending: {
            resolve?: (response: Response) => void;
            reject?: (error: unknown) => void;
            signal?: AbortSignal;
        } = {};
        context.mock.method(globalThis, "fetch", (_input: string | URL | Request, init?: RequestInit) => {
            assert.ok(init?.signal);
            pending.signal = init.signal;
            return new Promise<Response>((resolve, reject) => {
                Object.assign(pending, { resolve, reject });
            });
        });
        const settled: string[] = [];
        void resolveDestinationSearchHref(lagosPortugal, "Lagos Portugal", [lagosPortugal]).then((href) => {
            settled.push(href);
        });
        context.mock.timers.tick(999);
        await new Promise<void>((resolve) => setImmediate(resolve));
        assert.deepEqual(settled, []);
        assert.equal(pending.signal?.aborted, false);
        context.mock.timers.tick(1);
        await new Promise<void>((resolve) => setImmediate(resolve));
        assert.equal(pending.signal?.aborted, true);
        assert.deepEqual(settled, ["/discover/destinations/lagos"]);
        if (lateOutcome === "success") pending.resolve!(Response.json({ data: [lagosNigeria] }));
        else pending.reject!(new TypeError("Late provider error"));
        await new Promise<void>((resolve) => setImmediate(resolve));
        assert.deepEqual(settled, ["/discover/destinations/lagos"]);
    });
}

test("a primary lookup completed before its deadline keeps secondary disambiguation and removes cancellation work", async (context) => {
    context.mock.timers.enable({ apis: ["setTimeout"] });
    const controller = new AbortController();
    const pending: { resolve?: (response: Response) => void; signal?: AbortSignal } = {};
    context.mock.method(globalThis, "fetch", (_input: string | URL | Request, init?: RequestInit) => {
        assert.ok(init?.signal);
        pending.signal = init.signal;
        return new Promise<Response>((resolve) => {
            pending.resolve = resolve;
        });
    });
    const result = resolveDestinationSearchHref(lagosPortugal, "Lagos Portugal", [lagosPortugal], controller.signal);
    context.mock.timers.tick(999);
    pending.resolve!(Response.json({ data: [lagosNigeria, lagosPortugal] }));
    assert.equal(await result, "/discover/destinations/lagos?country=PRT");
    context.mock.timers.tick(10000);
    controller.abort();
    assert.equal(pending.signal?.aborted, false, "Completed requests must retain no timeout or caller abort listener");
});

for (const outcome of ["empty", "network", "provider"] as const) {
    test(`a ${outcome} primary lookup still creates a clean URL when no secondary destination is confirmed`, async (context) => {
        context.mock.method(globalThis, "fetch", async () => {
            if (outcome === "network") throw new TypeError("Offline");
            return outcome === "provider"
                ? Response.json({ error: { message: "Unavailable" } }, { status: 503 })
                : Response.json({ data: [] });
        });
        const url = new URL(
            await resolveDestinationSearchHref(lagosPortugal, "Lagos Portugal", [lagosPortugal]),
            "https://roamboard.test"
        );
        assert.equal(url.pathname, "/discover/destinations/lagos");
        assert.equal(url.search, "");
    });
}
