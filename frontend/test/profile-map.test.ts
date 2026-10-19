import assert from "node:assert/strict";
import test from "node:test";
import React, { Children, createElement, isValidElement, type ComponentProps, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import TravelMapSection from "../src/components/features/profile/TravelMapSection";
import VisitedWorldMap from "../src/components/features/profile/VisitedWorldMap";
import ProfileMapBoardLibrary from "../src/components/features/profile/ProfileMapBoardLibrary";
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

test("travel statistics render older payloads without treating missing counts as zero", () => {
    // Runtime API responses and older fixtures can omit fields despite the static type.
    const stats = {
        countriesVisited: 2,
        citiesExplored: 4,
        continentsCovered: 1,
        photosUploaded: 1543
    } as NonNullable<ComponentProps<typeof TravelMapSection>["stats"]>;

    for (const publicView of [false, true]) {
        const html = renderToStaticMarkup(
            createElement(TravelMapSection, {
                stats,
                publicView,
                mapComponent: createElement("div", null, "Map content")
            })
        );
        assert.match(html, /1,543/);
        assert.match(html, /Unavailable/);
        assert.match(html, /activities done/);
        assert.match(html, /Map content/);
        assert.doesNotMatch(html, />0</);
    }
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

test("destination selector opens the production carousel without a map click and follows collection filters", (context) => {
    // Preserve production state across server renders; browser keyboard/default-event behavior needs browser review.
    const state: Array<{ value: unknown }> = [];
    const cursor = { value: 0 };
    context.mock.method(React, "useState", ((initial: unknown) => {
        const index = cursor.value++;
        state[index] ??= { value: typeof initial === "function" ? initial() : initial };
        return [
            state[index].value,
            (next: unknown) => {
                state[index].value = typeof next === "function" ? next(state[index].value) : next;
            }
        ];
    }) as typeof React.useState);
    const destinations = [41, 52].map((boardId) => ({
        id: String(boardId),
        boardId,
        boardTitle: `Journey ${boardId}`,
        country: "Vietnam",
        countryCode: "VNM",
        city: "Ho Chi Minh City",
        latitude: 10,
        longitude: 106,
        collection: "published" as const
    }));
    type Props = {
        children?: ReactNode;
        value?: string;
        onChange?: (event: { target: { value: string } }) => void;
        onClick?: () => void;
        places?: typeof destinations;
    };
    function nodes(root: ReactNode): Array<{ type: unknown; props: Props }> {
        if (!isValidElement<Props>(root)) return [];
        return [{ type: root.type, props: root.props }, ...Children.toArray(root.props.children).flatMap(nodes)];
    }
    const captured: { tree: ReactNode } = { tree: null };
    function Probe() {
        captured.tree = VisitedWorldMap({ destinations });
        return null;
    }
    function render() {
        cursor.value = 0;
        renderToStaticMarkup(createElement(Probe));
        return nodes(captured.tree);
    }
    const initial = render();
    assert.ok(
        initial.some(
            (node) => node.type === "label" && Children.toArray(node.props.children).includes("Explore destination")
        )
    );
    assert.equal(
        initial.some((node) => node.type === ProfileMapBoardLibrary),
        false
    );
    assert.equal(initial.filter((node) => node.type === "option" && node.props.value === "location:106:10").length, 1);
    const selector = initial.find((node) => node.type === "select");
    assert.ok(selector?.props.onChange);
    selector.props.onChange({ target: { value: "country:VNM" } });
    const country = render();
    assert.deepEqual(
        country.find((node) => node.type === ProfileMapBoardLibrary)?.props.places?.map((place) => place.boardId),
        [41, 52]
    );
    country.find((node) => node.type === "select")?.props.onChange?.({ target: { value: "location:106:10" } });
    const location = render();
    assert.equal(location.find((node) => node.type === "select")?.props.value, "location:106:10");
    assert.deepEqual(
        location.find((node) => node.type === ProfileMapBoardLibrary)?.props.places?.map((place) => place.boardId),
        [41, 52]
    );
    location.find((node) => node.type === "select")?.props.onChange?.({ target: { value: "" } });
    const cleared = render();
    assert.equal(
        cleared.some((node) => node.type === ProfileMapBoardLibrary),
        false
    );
    cleared
        .find((node) => node.type === "button" && Children.toArray(node.props.children).includes("Published"))
        ?.props.onClick?.();
    const hidden = render();
    assert.deepEqual(
        hidden.filter((node) => node.type === "option").map((node) => node.props.value),
        [""]
    );
    hidden
        .find((node) => node.type === "button" && Children.toArray(node.props.children).includes("Published"))
        ?.props.onClick?.();
    assert.ok(render().some((node) => node.type === "option" && node.props.value === "country:VNM"));
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
