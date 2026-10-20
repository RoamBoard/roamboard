import assert from "node:assert/strict";
import test from "node:test";
import * as providers from "../src/features/destinations/destination.providers.js";
import type { QuotaObserver } from "../src/features/quotas/quota.types.js";

test("country articles accept an exact country title despite a distant provider center and reject nearby unrelated titles", async (t) => {
    const pages = [
        {
            title: "Japan airport",
            extract: "Wrong subject",
            fullurl: "https://en.wikivoyage.org/wiki/Japan_airport",
            coordinates: [{ lat: 36.5, lon: 139, primary: true }]
        },
        {
            title: "Japan",
            extract: "Country introduction",
            fullurl: "https://en.wikivoyage.org/wiki/Japan",
            coordinates: [{ lat: 35, lon: 136, primary: true }]
        }
    ];
    t.mock.method(globalThis, "fetch", async () => Response.json({ query: { pages } }));
    const country = {
        name: "Japan",
        country: "Japan",
        countryCode: "JPN",
        latitude: 36.5,
        longitude: 139,
        kind: "country" as const
    };
    assert.deepEqual(await providers.fetchWikivoyageGuide(country), {
        title: "Japan",
        description: "Country introduction",
        url: "https://en.wikivoyage.org/wiki/Japan"
    });
    assert.equal(await providers.fetchWikivoyageGuide({ ...country, kind: undefined }), null);
    pages[1]!.title = "Japan (Texas)";
    assert.equal(await providers.fetchWikivoyageGuide(country), null);
});

test("Wikivoyage guide rejects unrelated, distant and disambiguation pages and chooses the nearest city-name match", async (t) => {
    const urls: URL[] = [];
    t.mock.method(globalThis, "fetch", async (input: string | URL) => {
        urls.push(new URL(String(input)));
        return Response.json({
            query: {
                pages: [
                    {
                        title: "Paris",
                        extract: "Wrong continent",
                        fullurl: "https://en.wikivoyage.org/wiki/Paris",
                        coordinates: [{ lat: 48.86, lon: 2.35, primary: true }]
                    },
                    {
                        title: "Paris, Texas",
                        extract: "Ambiguous",
                        fullurl: "https://en.wikivoyage.org/wiki/Paris,_Texas",
                        pageprops: { disambiguation: "" },
                        coordinates: [{ lat: 33.66, lon: -95.55, primary: true }]
                    },
                    {
                        title: "Paris airport",
                        extract: "Wrong subject",
                        fullurl: "https://en.wikivoyage.org/wiki/Paris_airport",
                        coordinates: [{ lat: 33.66, lon: -95.55, primary: true }]
                    },
                    {
                        title: "Paris (Texas)",
                        extract: "Nearby but farther",
                        fullurl: "https://en.wikivoyage.org/wiki/Paris_(Texas)",
                        coordinates: [{ lat: 33.9, lon: -95.55, primary: true }]
                    },
                    {
                        title: "Paris, Texas",
                        extract: "The actual unchanged opening.\nSecond paragraph.",
                        fullurl: "https://en.wikivoyage.org/wiki/Paris,_Texas",
                        coordinates: [{ lat: 33.6609, lon: -95.5555, primary: true }]
                    }
                ]
            }
        });
    });
    const fetchGuide = Reflect.get(providers, "fetchWikivoyageGuide") as
        ((destination: unknown, observe?: QuotaObserver) => Promise<unknown>) | undefined;
    assert.ok(fetchGuide, "The guide needs a Wikivoyage adapter with location relevance checks");
    const observed: number[] = [];
    const result = await fetchGuide(
        { name: "Paris", country: "United States", countryCode: "USA", latitude: 33.6609, longitude: -95.5555 },
        async ({ status }) => {
            observed.push(status);
        }
    );
    assert.deepEqual(result, {
        title: "Paris, Texas",
        description: "The actual unchanged opening.\nSecond paragraph.",
        url: "https://en.wikivoyage.org/wiki/Paris,_Texas"
    });
    assert.equal(urls.length, 1);
    assert.equal(urls[0]?.origin, "https://en.wikivoyage.org");
    assert.equal(urls[0]?.searchParams.get("gsrsearch"), "Paris United States");
    assert.match(urls[0]?.searchParams.get("prop") ?? "", /coordinates/);
    assert.match(urls[0]?.searchParams.get("prop") ?? "", /pageprops/);
    assert.deepEqual(observed, [200]);
});

test("Wikivoyage guide ignores accents and requires primary Earth coordinates within fifty kilometres", async (t) => {
    const fetchGuide = Reflect.get(providers, "fetchWikivoyageGuide") as
        ((destination: unknown) => Promise<unknown>) | undefined;
    assert.ok(fetchGuide, "The guide needs a Wikivoyage adapter with location relevance checks");
    const destination = {
        name: "São Paulo",
        country: "Brazil",
        countryCode: "BRA",
        latitude: -23.55,
        longitude: -46.63
    };
    const pages: Array<Record<string, unknown>> = [
        {
            title: "Sao Paulo (city)",
            extract: "Original article text",
            fullurl: "https://en.wikivoyage.org/wiki/Sao_Paulo",
            coordinates: [{ lat: -23.55, lon: -46.63, primary: true, globe: "earth" }]
        }
    ];
    t.mock.method(globalThis, "fetch", async () => Response.json({ query: { pages } }));
    assert.deepEqual(await fetchGuide(destination), {
        title: "Sao Paulo (city)",
        description: "Original article text",
        url: "https://en.wikivoyage.org/wiki/Sao_Paulo"
    });
    pages[0]!.coordinates = [{ lat: -24.55, lon: -46.63, primary: true }];
    assert.equal(await fetchGuide(destination), null);
    pages[0]!.coordinates = [{ lat: -23.55, lon: -46.63, primary: false }];
    assert.equal(await fetchGuide(destination), null);
    pages[0]!.coordinates = [];
    assert.equal(await fetchGuide(destination), null);
});
