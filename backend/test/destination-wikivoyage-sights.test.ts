import assert from "node:assert/strict";
import test from "node:test";
import { fetchWikivoyageSights } from "../src/features/destinations/destination.sights.js";

const destination = { name: "Paris", country: "France", countryCode: "FRA", latitude: 48.8566, longitude: 2.3522 };
const point = (title: string, latitude = 48.8567, longitude = 2.3522) => ({
    type: "Feature",
    geometry: { type: "Point", coordinates: [longitude, latitude] },
    properties: { title, "marker-symbol": "1" }
});
const page = (pageid: number, title: string, see: unknown[], extra = {}) => ({
    pageid,
    ns: 0,
    title,
    mapdata: [JSON.stringify({ see })],
    ...extra
});

test("country guides read ordered city markers across the country and ignore sights and invalid geometry", async (t) => {
    const urls: URL[] = [];
    t.mock.method(globalThis, "fetch", async (input: string | URL) => {
        urls.push(new URL(String(input)));
        return Response.json({
            query: {
                pages: [
                    page(42, "Japan", [point("Kyoto temple", 36.5, 139)], {
                        mapdata: [
                            JSON.stringify({
                                city: [
                                    point('<a href="/wiki/Tokyo">Tokyo</a>', 35.6762, 139.6503),
                                    point("Kyoto", 35.0116, 135.7681),
                                    point("Tokyo", 35.7, 139.7),
                                    point("Invalid", 91, 139),
                                    {
                                        ...point("Line"),
                                        geometry: {
                                            type: "LineString",
                                            coordinates: [
                                                [139, 35],
                                                [140, 36]
                                            ]
                                        }
                                    },
                                    point(" ")
                                ],
                                see: [point("Kyoto temple", 36.5, 139)],
                                eat: [point("Restaurant", 36.5, 139)]
                            })
                        ]
                    })
                ]
            }
        });
    });
    const selected = { name: "Japan", country: "Japan", countryCode: "JPN", latitude: 36.5, longitude: 139 };
    assert.deepEqual(
        (await fetchWikivoyageSights({ ...selected, kind: "country" })).map((sight) => sight.name),
        ["Tokyo", "Kyoto"]
    );
    assert.equal(urls[0]?.searchParams.get("mpdgroups"), "city");
    const cities = await fetchWikivoyageSights({ ...selected, kind: "country" });
    assert.equal(cities[0]?.latitude, 35.6762);
    assert.equal(cities[0]?.longitude, 139.6503);
    assert.equal(cities[0]?.id, "wikivoyage:42:tokyo");
    assert.deepEqual(
        (await fetchWikivoyageSights(selected)).map((sight) => sight.name),
        ["Kyoto temple"]
    );
    assert.equal(urls[2]?.searchParams.get("mpdgroups"), "see");
});

test("an empty country city group stays empty without reading country subpages", async (t) => {
    const urls: URL[] = [];
    t.mock.method(globalThis, "fetch", async (input: string | URL) => {
        urls.push(new URL(String(input)));
        return Response.json({
            query: {
                pages: [
                    page(42, "Japan", [], {
                        mapdata: [JSON.stringify({ city: [], see: [] })],
                        links: [{ ns: 0, title: "Japan/District" }]
                    })
                ]
            }
        });
    });
    assert.deepEqual(
        await fetchWikivoyageSights({
            name: "Japan",
            country: "Japan",
            countryCode: "JPN",
            latitude: 36.5,
            longitude: 139,
            kind: "country"
        }),
        []
    );
    assert.equal(urls.length, 1);
});

test("Wikivoyage sights retain guide order, strip listing markup and ignore other groups, malformed geometry and distant places", async (t) => {
    const urls: URL[] = [];
    const feedback: number[] = [];
    const first = point('<a href="/wiki/Paris/7th#tower">Eiffel &amp; Tower</a>', 48.95);
    const see = [
        first,
        point("Nearby museum"),
        point("Eiffel &amp; Tower", 48.96),
        { type: "ExternalData", service: "geoshape", ids: "Q123" },
        {
            ...point("Line"),
            geometry: {
                type: "LineString",
                coordinates: [
                    [2.35, 48.85],
                    [2.36, 48.86]
                ]
            }
        },
        point("Too far", 49.2),
        point("Invalid", 91),
        point(" "),
        ...Array.from({ length: 12 }, (_, index) => point(`Sighting ${index}`, 48.87 + index * 0.001))
    ];
    const city = page(42, "Paris", see);
    city.mapdata = [JSON.stringify({ see, eat: [point("Restaurant")], sleep: [point("Hotel")] })];
    t.mock.method(globalThis, "fetch", async (input: string | URL) => {
        urls.push(new URL(String(input)));
        return Response.json({ query: { pages: [city] } });
    });
    const result = await fetchWikivoyageSights(destination, async ({ status }) => {
        feedback.push(status);
    });
    assert.deepEqual(
        result.map((place) => place.name),
        [
            "Eiffel & Tower",
            "Nearby museum",
            "Sighting 0",
            "Sighting 1",
            "Sighting 2",
            "Sighting 3",
            "Sighting 4",
            "Sighting 5",
            "Sighting 6",
            "Sighting 7"
        ]
    );
    assert.equal(result[0]?.id, "wikivoyage:42:eiffel & tower");
    assert.equal(result[0]?.provider, "wikivoyage");
    assert.equal(result[0]?.latitude, 48.95, "The editorial first listing must stay first despite being farther away");
    assert.doesNotMatch(JSON.stringify(result), /<a|href=|Restaurant|Hotel|Too far|Invalid/);
    assert.equal(urls.length, 1);
    assert.equal(urls[0]?.origin, "https://en.wikivoyage.org");
    assert.equal(urls[0]?.searchParams.get("gsrsearch"), "Paris France");
    assert.equal(urls[0]?.searchParams.get("mpdgroups"), "see");
    assert.deepEqual(feedback, [200]);
});

test("same-name guides outside the selected city cannot contribute distant sights and a geographic qualifier is accepted", async (t) => {
    const state = {
        pages: [
            page(10, "Paris", [point("Eiffel Tower")]),
            page(11, "Paris (Texas)", [point("Texas museum", 33.661, -95.5555)])
        ]
    };
    t.mock.method(globalThis, "fetch", async () => Response.json({ query: { pages: state.pages } }));
    const texas = {
        name: "Paris",
        country: "United States",
        countryCode: "USA",
        latitude: 33.6609,
        longitude: -95.5555
    };
    const result = await fetchWikivoyageSights(texas);
    assert.deepEqual(
        result.map((place) => place.name),
        ["Texas museum"]
    );
    state.pages = [
        page(10, "Paris", [point("Eiffel Tower")]),
        page(12, "Unrelated town", [point("Wrong guide", 33.661, -95.5555)])
    ];
    assert.deepEqual(await fetchWikivoyageSights(texas), []);
});

test("a city without direct sights reads at most ten district guides in one extra batch and interleaves their selections", async (t) => {
    const urls: URL[] = [];
    const feedback: number[] = [];
    const reservations = { count: 0 };
    t.mock.method(globalThis, "fetch", async (input: string | URL) => {
        const url = new URL(String(input));
        urls.push(url);
        if (urls.length === 1)
            return Response.json({
                query: {
                    pages: [
                        page(40, "Paris", [], {
                            links: [
                                { ns: 0, title: "Other city/District" },
                                ...Array.from({ length: 12 }, (_, index) => ({
                                    ns: 0,
                                    title: `Paris/District ${index}`
                                }))
                            ]
                        })
                    ]
                }
            });
        const titles = url.searchParams.get("titles")?.split("|") ?? [];
        assert.equal(titles.length, 10);
        return Response.json({
            query: {
                pages: titles
                    .map((title, index) =>
                        page(100 + index, title, [point(`District ${index} first`), point(`District ${index} second`)])
                    )
                    .reverse()
            }
        });
    });
    const result = await fetchWikivoyageSights(
        destination,
        async ({ status }) => {
            feedback.push(status);
        },
        async () => {
            reservations.count += 1;
        }
    );
    assert.deepEqual(
        result.map((place) => place.name),
        Array.from({ length: 10 }, (_, index) => `District ${index} first`)
    );
    assert.equal(result[0]?.id, "wikivoyage:100:district 0 first");
    assert.equal(urls.length, 2);
    assert.equal(reservations.count, 1);
    assert.deepEqual(feedback, [200, 200]);
});

test("missing guides and see lists are empty successes while upstream failures report quota feedback without retries", async (t) => {
    const state = { fail: false, calls: 0 };
    const feedback: number[] = [];
    t.mock.method(globalThis, "fetch", async () => {
        state.calls += 1;
        return state.fail
            ? Response.json(
                  { error: { message: "Private provider detail" } },
                  { status: 429, headers: { "Retry-After": "30" } }
              )
            : Response.json({ query: { pages: [page(40, "Paris", [])] } });
    });
    assert.deepEqual(await fetchWikivoyageSights(destination), []);
    state.fail = true;
    await assert.rejects(
        fetchWikivoyageSights(destination, async ({ status }) => {
            feedback.push(status);
        })
    );
    assert.equal(state.calls, 2);
    assert.deepEqual(feedback, [429]);
});
