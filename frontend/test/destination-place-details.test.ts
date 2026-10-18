import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DestinationPage } from "../src/components/features/destinations/DestinationPage";
import { loadPlaceDetails, placeBoardHref } from "../src/lib/destination-places";
import type { DestinationGuideData, DestinationGuideInput, PlaceDetails } from "../src/lib/destination-guides";

const city: DestinationGuideInput = { name: "Fukuoka", country: "JPN", latitude: 33.5902, longitude: 130.4017 };
const place = {
    id: "wikivoyage:12208:nakasu",
    provider: "wikivoyage" as const,
    name: "Nakasu",
    address: "Fukuoka, Japan",
    latitude: 33.591,
    longitude: 130.407,
    city: city.name,
    country: city.country
};
const details: PlaceDetails = {
    placeId: place.id,
    description: "Walk beside the river and visit the food stalls.",
    sourceUrl: "https://en.wikivoyage.org/?curid=12208#Nakasu",
    image: null,
    unavailable: []
};

function replaceFetch(t: TestContext, replacement: typeof fetch) {
    const previous = globalThis.fetch;
    globalThis.fetch = replacement;
    t.after(() => {
        globalThis.fetch = previous;
    });
}

test("selected-sight lookup sends its city identity and encoded ID through the public read endpoint", async (t) => {
    replaceFetch(t, async (input, init) => {
        const url = new URL(String(input));
        assert.equal(url.pathname, "/api/v1/destinations/place-details");
        assert.deepEqual(Object.fromEntries(url.searchParams), {
            name: city.name,
            country: city.country,
            latitude: String(city.latitude),
            longitude: String(city.longitude),
            placeId: place.id
        });
        assert.equal(init?.credentials, "include");
        assert.equal(init?.cache, "no-store");
        return Response.json({ data: details });
    });
    assert.deepEqual(await loadPlaceDetails(city, place.id), details);
});

test("missing image data is preserved and rejected detail requests do not masquerade as empty content", async (t) => {
    const responses = [
        Response.json({ data: { ...details, description: null, unavailable: ["image"] } }),
        Response.json(
            { error: { code: "PROVIDER_FAILED", message: "Sight information could not be loaded." } },
            { status: 502 }
        )
    ];
    replaceFetch(t, async () => responses.shift()!);
    const partial = await loadPlaceDetails(city, place.id);
    assert.equal(partial.description, null);
    assert.equal(partial.image, null);
    assert.deepEqual(partial.unavailable, ["image"]);
    await assert.rejects(loadPlaceDetails(city, place.id), /Sight information could not be loaded/);
});

function guide(changes: Partial<DestinationGuideData> = {}): DestinationGuideData {
    return {
        destination: { ...city, country: "Japan", countryCode: "JPN" },
        article: {
            title: "Fukuoka",
            description: "Fukuoka is a city in Japan.",
            url: "https://en.wikivoyage.org/wiki/Fukuoka"
        },
        cityTip: {
            title: "Getting around",
            text: "Take the subway between Hakata and the city centre.",
            url: "https://en.wikivoyage.org/wiki/Fukuoka#Get_around"
        },
        images: [],
        places: [place],
        boards: [],
        page: 1,
        hasMore: false,
        unavailable: [],
        ...changes
    };
}

test("About renders the transport tip with its source and keeps the introduction when tips are absent", () => {
    const markup = renderToStaticMarkup(createElement(DestinationPage, { destination: guide() }));
    assert.match(markup, /Getting around/);
    assert.match(markup, /Take the subway between Hakata and the city centre/);
    assert.match(markup, /href="https:\/\/en\.wikivoyage\.org\/wiki\/Fukuoka#Get_around"/);
    assert.match(markup, /CC BY-SA 4\.0/);
    const absent = renderToStaticMarkup(createElement(DestinationPage, { destination: guide({ cityTip: null }) }));
    assert.doesNotMatch(absent, /Getting around/);
    assert.match(absent, /Fukuoka is a city in Japan/);
    const failed = renderToStaticMarkup(
        createElement(DestinationPage, { destination: guide({ cityTip: null, unavailable: ["cityTip"] }) })
    );
    assert.match(failed, /Fukuoka is a city in Japan/);
    assert.match(failed, /Retry destination information/);
});

test("detail lookup leaves Board-prefill data at the travel guide's canonical location", async (t) => {
    const original = structuredClone(place);
    const boardBefore = placeBoardHref(place);
    replaceFetch(t, async (input) => {
        assert.equal(new URL(String(input)).pathname, "/api/v1/destinations/place-details");
        return Response.json({ data: details });
    });
    await loadPlaceDetails(city, place.id);
    assert.deepEqual(place, original);
    assert.equal(placeBoardHref(place), boardBefore);
});
