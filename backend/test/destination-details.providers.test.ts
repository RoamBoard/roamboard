import assert from "node:assert/strict";
import test from "node:test";
import { createWikivoyageDetails } from "../src/features/destinations/destination.details.js";
import type { GuidePlace } from "../src/features/destinations/destination.types.js";

const city = { name: "Fukuoka", country: "Japan", countryCode: "JPN", latitude: 33.5902, longitude: 130.4017 };
const sight: GuidePlace = {
    provider: "wikivoyage",
    id: "wikivoyage:12208:nakasu",
    name: "Nakasu",
    address: "Fukuoka, Japan",
    latitude: 33.591,
    longitude: 130.407
};

// These fixtures use MediaWiki's plain extracts and rendered map listing references.
function page(extract: string, withImage = true) {
    return {
        pageid: 12208,
        title: "Fukuoka",
        coordinates: [{ lat: city.latitude, lon: city.longitude, primary: true, globe: "earth" }],
        extract,
        mapdata: [
            JSON.stringify({
                see: [
                    {
                        properties: {
                            title: '<a href="/wiki/Fukuoka#Nakasu">Nakasu</a>',
                            description: withImage
                                ? '<a href="/wiki/File:Nakasu_river.jpg"><img src="/thumb.jpg"></a>'
                                : ""
                        }
                    }
                ]
            })
        ]
    };
}

function commons(overrides = {}) {
    return {
        pageid: 90,
        imageinfo: [
            {
                mime: "image/jpeg",
                width: 3000,
                height: 2000,
                url: "https://upload.wikimedia.org/wikipedia/commons/n/n1/Nakasu_river.jpg",
                descriptionurl: "https://commons.wikimedia.org/wiki/File:Nakasu_river.jpg",
                thumburl:
                    "https://upload.wikimedia.org/wikipedia/commons/thumb/n/n1/Nakasu_river.jpg/1200px-Nakasu_river.jpg",
                thumbwidth: 1200,
                thumbheight: 800,
                extmetadata: {
                    Artist: { value: '<a href="/wiki/User:Photographer">River &amp; Street Photographer</a>' },
                    LicenseShortName: { value: "CC BY-SA 4.0" },
                    LicenseUrl: { value: "https://creativecommons.org/licenses/by-sa/4.0/" }
                },
                ...overrides
            }
        ]
    };
}

test("transport tips come from Get around prose, retain attribution and stop before the next city-guide section", async (t) => {
    const urls: URL[] = [];
    const source = page(
        [
            "Fukuoka is a city in Japan.",
            "== Get in ==",
            "Airport arrival information belongs to another section.",
            "== Get around ==",
            "=== By subway ===",
            "Take the subway between Hakata Station and the city centre. Trains run across several useful city routes. A third sentence must be omitted.",
            "== See ==",
            "1 Nakasu, Riverside streets with food stalls."
        ].join("\n")
    );
    t.mock.method(globalThis, "fetch", async (input: string | URL) => {
        urls.push(new URL(String(input)));
        return Response.json({ query: { pages: [source] } });
    });
    const provider = createWikivoyageDetails(async () => {});
    const tip = await provider.cityTip(city);
    assert.equal(tip?.title, "Getting around");
    assert.equal(
        tip?.text,
        "Take the subway between Hakata Station and the city centre. Trains run across several useful city routes."
    );
    assert.equal(tip?.url, "https://en.wikivoyage.org/?curid=12208#Get_around");
    assert.equal(urls[0]?.origin, "https://en.wikivoyage.org");
    assert.equal(urls[0]?.searchParams.get("explaintext"), "1");
    assert.equal(urls[0]?.searchParams.get("exsectionformat"), "wiki");
});

test("same-name distant cities and missing transport sections provide no invented tip", async (t) => {
    const state = { pages: [page("== Get around ==\nUse the subway between the station and the city centre.")] };
    state.pages[0]!.coordinates = [{ lat: 48.8566, lon: 2.3522, primary: true, globe: "earth" }];
    t.mock.method(globalThis, "fetch", async () => Response.json({ query: { pages: state.pages } }));
    const provider = createWikivoyageDetails(async () => {});
    assert.equal(await provider.cityTip(city), null);
    state.pages = [page("== See ==\n1 Nakasu, A riverside district with street food.")];
    assert.equal(await provider.cityTip(city), null);
});

test("a coordinate search is followed by one matched-page extract shared with selected-sight details", async (t) => {
    const urls: URL[] = [];
    const reservations = { count: 0 };
    const source = page(
        "== Get around ==\nTake the subway between Hakata Station and the city centre.\n== See ==\n1 Nakasu, Riverside streets with food stalls.",
        false
    );
    t.mock.method(globalThis, "fetch", async (input: string | URL) => {
        const url = new URL(String(input));
        urls.push(url);
        if (url.searchParams.get("generator") === "search") {
            return Response.json({
                query: {
                    pages: [
                        { pageid: 42, title: "Fukuoka", coordinates: [{ lat: 48.8566, lon: 2.3522, primary: true }] },
                        { pageid: source.pageid, title: source.title, coordinates: source.coordinates }
                    ]
                }
            });
        }
        assert.equal(url.searchParams.get("pageids"), "12208");
        assert.equal(url.searchParams.get("explaintext"), "1");
        assert.equal(url.searchParams.get("exlimit"), "1");
        return Response.json({ query: { pages: [source] } });
    });
    const provider = createWikivoyageDetails(async () => {
        reservations.count += 1;
    });
    const tip = await provider.cityTip(city);
    assert.equal(tip?.text, "Take the subway between Hakata Station and the city centre.");
    assert.equal(tip?.url, "https://en.wikivoyage.org/?curid=12208#Get_around");
    assert.equal(urls.length, 2);
    assert.equal(reservations.count, 1);
    const selected = await provider.placeDetails(sight);
    assert.equal(selected.description, "Riverside streets with food stalls.");
    assert.equal(urls.length, 2, "The full city extract should be reused when its sight is selected");
    assert.equal(reservations.count, 1);
});

test("a sight gets its own numbered listing description rather than a longer similarly named listing", async (t) => {
    t.mock.method(globalThis, "fetch", async () =>
        Response.json({
            query: {
                pages: [
                    page(
                        [
                            "== See ==",
                            "1 Nakasu Shrine, A separate shrine away from the riverside district.",
                            "2 Nakasu, Walk beside the river and visit the food stalls. The district has several bridges. A third sentence is not needed.",
                            "3 Ohori Park, Lakeside paths and gardens."
                        ].join("\n"),
                        false
                    )
                ]
            }
        })
    );
    const result = await createWikivoyageDetails(async () => {}).placeDetails(sight);
    assert.equal(result.placeId, sight.id);
    assert.equal(
        result.description,
        "Walk beside the river and visit the food stalls. The district has several bridges."
    );
    assert.equal(result.sourceUrl, "https://en.wikivoyage.org/?curid=12208#Nakasu");
    assert.equal(result.image, null);
    assert.deepEqual(result.unavailable, []);
});

test("listing-linked Commons photographs retain high resolution and plain photographer and license credits", async (t) => {
    const reservations = { count: 0 };
    const statuses: number[] = [];
    const urls: URL[] = [];
    t.mock.method(globalThis, "fetch", async (input: string | URL) => {
        const url = new URL(String(input));
        urls.push(url);
        return Response.json({
            query: {
                pages: [
                    url.hostname === "commons.wikimedia.org"
                        ? commons()
                        : page("== See ==\n1 Nakasu, Riverside streets and food stalls.")
                ]
            }
        });
    });
    const provider = createWikivoyageDetails(async () => {
        reservations.count += 1;
    });
    const result = await provider.placeDetails(sight, async ({ status }) => {
        statuses.push(status);
    });
    assert.ok(result.image);
    assert.equal(result.image.width, 1200);
    assert.equal(result.image.height, 800);
    assert.equal(result.image.alt, "Nakasu");
    assert.equal(result.image.author, "River & Street Photographer");
    assert.equal(result.image.sourceUrl, "https://commons.wikimedia.org/wiki/File:Nakasu_river.jpg");
    assert.equal(result.image.licenseName, "CC BY-SA 4.0");
    assert.equal(result.image.licenseUrl, "https://creativecommons.org/licenses/by-sa/4.0/");
    assert.doesNotMatch(JSON.stringify(result.image), /<a|<img|href=/);
    assert.equal(urls[1]?.searchParams.get("titles"), "File:Nakasu_river.jpg");
    assert.equal(urls[1]?.searchParams.get("iiurlwidth"), "1200");
    assert.equal(reservations.count, 1);
    assert.deepEqual(statuses, [200, 200]);
});

test("missing listing references, low-resolution photos and missing credits remain named-placeholder data", async (t) => {
    const state = {
        photo: commons(),
        source: page("== See ==\n1 Nakasu, Riverside streets and food stalls.", false),
        calls: 0
    };
    t.mock.method(globalThis, "fetch", async (input: string | URL) => {
        state.calls += 1;
        return Response.json({
            query: { pages: [new URL(String(input)).hostname === "commons.wikimedia.org" ? state.photo : state.source] }
        });
    });
    const missing = await createWikivoyageDetails(async () => {}).placeDetails(sight);
    assert.equal(missing.image, null);
    assert.deepEqual(missing.unavailable, []);
    assert.equal(state.calls, 1);
    state.source = page("== See ==\n1 Nakasu, Riverside streets and food stalls.");
    for (const photo of [commons({ width: 600, height: 400 }), commons({ extmetadata: {} })]) {
        state.photo = photo;
        const result = await createWikivoyageDetails(async () => {}).placeDetails(sight);
        assert.equal(result.image, null);
        assert.deepEqual(result.unavailable, []);
    }
});

test("a Commons failure preserves sight prose and a later explicit call can retry the photo", async (t) => {
    const state = { commonsCalls: 0 };
    t.mock.method(globalThis, "fetch", async (input: string | URL) => {
        if (new URL(String(input)).hostname !== "commons.wikimedia.org")
            return Response.json({
                query: { pages: [page("== See ==\n1 Nakasu, Riverside streets and food stalls.")] }
            });
        state.commonsCalls += 1;
        return state.commonsCalls === 1
            ? new Response("Provider failed", { status: 503 })
            : Response.json({ query: { pages: [commons()] } });
    });
    const provider = createWikivoyageDetails(async () => {});
    const first = await provider.placeDetails(sight);
    assert.equal(first.description, "Riverside streets and food stalls.");
    assert.equal(first.image, null);
    assert.deepEqual(first.unavailable, ["image"]);
    const retried = await provider.placeDetails(sight);
    assert.ok(retried.image);
    assert.deepEqual(retried.unavailable, []);
    assert.equal(state.commonsCalls, 2);
});
