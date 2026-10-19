import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import TravelMapSection from "../src/components/features/profile/TravelMapSection";
import VisitedWorldMap from "../src/components/features/profile/VisitedWorldMap";
import { loadMapDestinations, ProfileApiError } from "../src/lib/profile";

test("travel statistics show the fifth activities done count and preserve unavailable data", () => {
    const html = renderToStaticMarkup(
        createElement(TravelMapSection, {
            stats: {
                countriesVisited: 2,
                citiesExplored: 4,
                continentsCovered: 1,
                photosUploaded: 1543,
                activitiesDone: 1207
            },
            mapComponent: createElement("div", null, "Map content")
        })
    );
    for (const label of [
        "countries visited",
        "cities explored",
        "continents covered",
        "photos uploaded",
        "activities done"
    ])
        assert.ok(html.includes(label));
    assert.match(html, /1,207/);
    assert.match(html, /Map content/);
    const unavailable = renderToStaticMarkup(createElement(TravelMapSection, { stats: null, mapComponent: null }));
    assert.match(unavailable, /Statistics could not be loaded/);
    assert.doesNotMatch(unavailable, /activities done/);
});

test("globe enables both permitted collections by default and keeps map exploration controls concise", () => {
    const destination = {
        id: "42:7",
        boardId: 42,
        boardTitle: "Bali memories",
        country: "Indonesia",
        countryCode: "IDN",
        city: "Denpasar",
        latitude: -8.65,
        longitude: 115.22,
        collection: "published" as const
    };
    for (const allowSaved of [false, true]) {
        const html = renderToStaticMarkup(createElement(VisitedWorldMap, { destinations: [destination], allowSaved }));
        assert.match(html, /aria-pressed="true"[^>]*>.*Published/);
        assert.match(html, /Interactive grayscale world globe/);
        assert.match(html, /Loading world map/);
        assert.equal(html.includes(">Saved</button>"), allowSaved);
        assert.equal((html.match(/aria-pressed="true"/g) ?? []).length, allowSaved ? 2 : 1);
        assert.doesNotMatch(html, /aria-pressed="false"/);
        assert.doesNotMatch(
            html,
            /Select a colored country|Hover a board|Hover or focus a board|Browse individual locations|Close previews|selected filters|aria-label="Board countries"|aria-label="Board locations"/
        );
    }
    const empty = renderToStaticMarkup(createElement(VisitedWorldMap, { destinations: [] }));
    assert.match(empty, /Interactive grayscale world globe/);
    assert.doesNotMatch(empty, /No board locations|Browse individual locations|Close previews/);
});

test("map API helper requests published by default and session-owned saved destinations explicitly", async (context) => {
    const calls: Array<{ url: string; credentials?: RequestCredentials; cache?: RequestCache }> = [];
    context.mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
        calls.push({ url: String(input), credentials: init?.credentials, cache: init?.cache });
        return Response.json({ data: [{ id: "3:1", boardId: 3, countryCode: "VNM", collection: "saved" }] });
    });
    await loadMapDestinations();
    const result = await loadMapDestinations("saved");
    await loadMapDestinations("saved", "ada_lovelace");
    assert.ok(calls[0].url.endsWith("/api/v1/users/me/map-destinations?scope=published"));
    assert.ok(calls[1].url.endsWith("/api/v1/users/me/map-destinations?scope=saved"));
    assert.ok(calls[2].url.endsWith("/api/v1/users/by-handle/ada_lovelace/saved-map-destinations"));
    assert.ok(calls.every((call) => call.credentials === "include" && call.cache === "no-store"));
    assert.equal(result[0].boardId, 3);
});

test("saved map authorization failures propagate for visible error and retry handling", async (context) => {
    context.mock.method(globalThis, "fetch", async () =>
        Response.json({ error: { code: "UNAUTHORIZED", message: "Sign in required" } }, { status: 401 })
    );
    await assert.rejects(
        () => loadMapDestinations("saved"),
        (error: unknown) =>
            error instanceof ProfileApiError && error.status === 401 && error.message === "Sign in required"
    );
});
