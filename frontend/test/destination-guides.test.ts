import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { Children, createElement, isValidElement, type ComponentProps, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import DestinationRoute, { generateMetadata } from "../src/app/discover/destinations/[slug]/page";
import NewBoardPage from "../src/app/boards/new/page";
import BoardCreator from "../src/components/features/boards/BoardCreator";
import { DestinationPage } from "../src/components/features/destinations/DestinationPage";
import {
    destinationGuideHref,
    destinationPhotoUrl,
    getDestinationGuideInput,
    loadDestinationGuide,
    type DestinationGuideData,
    type DestinationGuideInput
} from "../src/lib/destination-guides";
import type { Destination } from "../src/lib/destinations";
import {
    getStartingPlace,
    placeBoardHref,
    matchPlace,
    placeSourceUrl,
    type StartingPlace
} from "../src/lib/destination-places";

const tokyo: DestinationGuideInput = { name: "Tokyo", country: "JPN", latitude: 35.6762, longitude: 139.6503 };

function city(changes: Partial<Destination> = {}): Destination {
    return {
        id: "provider-tokyo",
        name: "Tokyo",
        address: "Tokyo, Japan",
        latitude: 35.6762,
        longitude: 139.6503,
        placeType: "place",
        context: ["Japan"],
        country: "Japan",
        countryCode: "JPN",
        city: "Tokyo",
        ...changes
    };
}
function guide(changes: Partial<DestinationGuideData> = {}): DestinationGuideData {
    return {
        cityTip: null,
        destination: { name: "Tokyo", country: "Japan", countryCode: "JPN", latitude: 35.6762, longitude: 139.6503 },
        article: {
            title: "Tokyo",
            description: "Tokyo is a city in Japan. This opening comes from the matched article.",
            url: "https://en.wikivoyage.org/wiki/Tokyo"
        },
        images: ["opening", "closing"].map((id) => ({
            id,
            url: `https://images.unsplash.com/${id}.jpg?ixid=guide-${id}&w=640&h=480&dpr=1&q=60&fit=crop`,
            thumbnailUrl: `https://images.unsplash.com/${id}-small.jpg`,
            alt: `${id} view of Tokyo`,
            photographer: `Photographer ${id}`,
            photographerUrl: `https://unsplash.com/@${id}`,
            sourceUrl: `https://unsplash.com/photos/${id}`,
            width: 1600,
            height: 1000
        })),
        places: [
            {
                id: "geoapify-temple",
                name: "Senso-ji",
                address: "Asakusa, Tokyo, Japan",
                latitude: 35.7148,
                longitude: 139.7967
            }
        ],
        boards: [
            {
                boardId: 721,
                username: "real_traveller",
                title: "Tokyo evening stations",
                description: "Notes saved by the author.",
                durationDays: 2,
                tags: ["Architecture"],
                activityTitles: ["Tokyo Station", "Ueno"],
                images: [
                    { url: "/api/v1/images/80/content?variant=display", alt: "The chosen Board cover" },
                    {
                        url: "https://images.unsplash.com/activity.jpg?ixid=board-cover&w=640&h=480&dpr=1&q=60&fit=crop",
                        alt: "A station platform",
                        photographer: "Ada Rail",
                        photographerUrl: "https://unsplash.com/@adarail",
                        sourceUrl: "https://unsplash.com/photos/activity"
                    }
                ]
            }
        ],
        page: 1,
        hasMore: false,
        unavailable: [],
        ...changes
    };
}
function replaceFetch(t: TestContext, replacement: typeof fetch) {
    const original = globalThis.fetch;
    globalThis.fetch = replacement;
    t.after(() => {
        globalThis.fetch = original;
    });
}
function routeInput(node: ReactNode): unknown {
    if (!isValidElement<{ input?: unknown; children?: ReactNode }>(node)) return;
    return node.props.input ?? Children.toArray(node.props.children).map(routeInput).find(Boolean);
}
function renderWithRouter(content: ReactNode) {
    return renderToStaticMarkup(
        createElement(
            AppRouterContext.Provider,
            {
                value: {
                    bfcacheId: "guide-test",
                    back: () => {},
                    forward: () => {},
                    refresh: () => {},
                    push: () => {},
                    replace: () => {},
                    prefetch: () => {}
                }
            },
            content
        )
    );
}

function renderGuide(destination = guide(), extra: Partial<Parameters<typeof DestinationPage>[0]> = {}) {
    return renderWithRouter(createElement(DestinationPage, { destination, ...extra }));
}

function startingEditor(node: ReactNode): ReactElement<ComponentProps<typeof BoardCreator>> | undefined {
    if (!isValidElement<ComponentProps<typeof BoardCreator> & { children?: ReactNode }>(node)) return;
    if (node.type === BoardCreator) return node;
    return Children.toArray(node.props.children).map(startingEditor).find(Boolean);
}

test("a selected place reaches a new scratch Board as an editable activity without changing its location", async () => {
    const place: StartingPlace = {
        id: "geoapify:Senso-ji/123",
        name: "Senso-ji & Asakusa",
        address: "2 Chome-3-1 Asakusa, Taito City",
        latitude: 35.7148,
        longitude: 139.7967,
        city: "Tokyo",
        country: "JPN"
    };
    const href = new URL(placeBoardHref(place), "https://roamboard.example");
    assert.equal(href.pathname, "/boards/new");
    assert.equal(href.searchParams.get("mode"), "scratch");
    const params = Object.fromEntries(href.searchParams);
    assert.deepEqual(getStartingPlace(params), place);
    const editor = startingEditor(await NewBoardPage({ searchParams: Promise.resolve(params) }));
    assert.ok(editor);
    assert.equal(editor.props.initialMode, "scratch");
    assert.deepEqual(editor.props.initialPlace, place);
    assert.equal(editor.props.initialBoardId, undefined);
    const markup = renderWithRouter(editor);
    assert.match(markup, /Senso-ji &amp; Asakusa/);
    assert.match(markup, /Tokyo board/);
    assert.match(markup, /Day 1/);
});

test("incomplete or tampered shared place URLs open the ordinary creator without a prefilled activity", async () => {
    const params = Object.fromEntries(
        new URL(
            placeBoardHref({
                ...guide().places[0],
                city: "Tokyo",
                country: "JPN"
            }),
            "https://roamboard.example"
        ).searchParams
    );
    for (const changes of [
        { latitude: "" },
        { longitude: "NaN" },
        { latitude: "91" },
        { longitude: "181" },
        { country: "JP" },
        { country: "ZZZ" },
        { place: " " },
        { placeId: "" },
        { city: undefined },
        { place: ["Senso-ji", "Another place"] }
    ]) {
        assert.equal(getStartingPlace({ ...params, ...changes }), undefined);
    }
    const editor = startingEditor(await NewBoardPage({ searchParams: Promise.resolve({ ...params, latitude: "" }) }));
    assert.ok(editor);
    assert.equal(editor.props.initialPlace, undefined);
});

test("travel-guide sights keep canonical coordinates when preparing a Board without Geoapify confirmation", async (t) => {
    const place: StartingPlace = {
        id: "wikivoyage:98765:sensoji",
        provider: "wikivoyage",
        name: "Senso-ji",
        address: "Asakusa, Tokyo",
        latitude: 35.7148,
        longitude: 139.7967,
        city: "Tokyo",
        country: "JPN"
    };
    replaceFetch(t, async () => {
        assert.fail("A travel-guide sight must not require an independent Geoapify confirmation");
    });
    const params = Object.fromEntries(new URL(placeBoardHref(place), "https://roamboard.example").searchParams);
    assert.equal(params.placeId, place.id);
    assert.equal(params.latitude, String(place.latitude));
    assert.equal(params.longitude, String(place.longitude));
    const editor = startingEditor(await NewBoardPage({ searchParams: Promise.resolve(params) }));
    assert.ok(editor);
    assert.equal(editor.props.initialPlace?.id, place.id);
    assert.equal(editor.props.initialPlace?.latitude, place.latitude);
    assert.equal(editor.props.initialPlace?.longitude, place.longitude);
    assert.match(renderWithRouter(editor), /Senso-ji/);
});

test("selected-sight map matching sends only location identity and leaves its canonical record unchanged", async (t) => {
    const place: StartingPlace = {
        ...guide().places[0],
        id: "wikivoyage:98765:sensoji",
        provider: "wikivoyage",
        city: "Tokyo",
        country: "JPN"
    };
    const original = { ...place };
    const calls: Array<{ url: URL; init?: RequestInit }> = [];
    replaceFetch(t, async (input, init) => {
        calls.push({ url: new URL(String(input)), init });
        return Response.json({ data: { latitude: 35.715, longitude: 139.797 } });
    });
    assert.deepEqual(await matchPlace(place), { latitude: 35.715, longitude: 139.797 });
    assert.deepEqual(place, original);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url.origin, new URL(process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001").origin);
    assert.equal(calls[0].url.pathname, "/api/v1/destinations/match-place");
    assert.equal(calls[0].init?.method, "POST");
    assert.equal(calls[0].init?.credentials, "include");
    assert.equal(new Headers(calls[0].init?.headers).get("Content-Type"), "application/json");
    assert.deepEqual(JSON.parse(String(calls[0].init?.body)), {
        name: place.name,
        city: place.city,
        country: place.country,
        latitude: place.latitude,
        longitude: place.longitude
    });
    const params = new URL(placeBoardHref(place), "https://roamboard.example").searchParams;
    assert.equal(params.get("latitude"), String(original.latitude));
    assert.equal(params.get("longitude"), String(original.longitude));
});

test("an unmatched sight and a failed map match remain distinct without automatic retry", async (t) => {
    const place: StartingPlace = { ...guide().places[0], city: "Tokyo", country: "JPN" };
    const calls = { count: 0 };
    replaceFetch(t, async () => {
        calls.count += 1;
        return calls.count === 1
            ? Response.json({ data: null })
            : Response.json({ error: { message: "Internal provider failure detail" } }, { status: 502 });
    });
    assert.equal(await matchPlace(place), null);
    assert.equal(calls.count, 1);
    await assert.rejects(matchPlace(place), (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.match(error.message, /could not match.*travel-guide location/i);
        assert.doesNotMatch(error.message, /Internal provider failure detail/);
        return true;
    });
    assert.equal(calls.count, 2);
});

test("travel-guide source links derive a fixed Wikivoyage host from the original page ID", () => {
    const place: StartingPlace = {
        ...guide().places[0],
        id: "wikivoyage:98765:sensoji",
        city: "Tokyo",
        country: "JPN"
    };
    const source = placeSourceUrl(place);
    assert.ok(source, "Travel-guide records must retain attribution without a provider flag");
    const url = new URL(source);
    assert.equal(url.protocol, "https:");
    assert.equal(url.hostname, "en.wikivoyage.org");
    assert.ok(url.searchParams.get("curid") === "98765" || url.pathname.includes("98765"));
    for (const id of ["geoapify:123", "mapbox:123", "https://example.org/98765", "wikivoyage:evil.example:sight"]) {
        assert.equal(placeSourceUrl({ ...place, id }), undefined);
    }
});

test("destination photos remove small image caps while preserving Unsplash tracking", () => {
    const source =
        "https://images.unsplash.com/photo-city?ixid=tracked-photo&ixlib=rb-4.1.0&w=640&h=480&dpr=1&q=60&fit=crop";
    const large = new URL(destinationPhotoUrl(source));
    assert.equal(large.origin, "https://images.unsplash.com");
    assert.equal(large.pathname, "/photo-city");
    assert.deepEqual(Object.fromEntries(large.searchParams), {
        ixid: "tracked-photo",
        ixlib: "rb-4.1.0",
        w: "3200",
        q: "85",
        fit: "max",
        auto: "format"
    });
    assert.equal(new URL(destinationPhotoUrl(source, 1200)).searchParams.get("w"), "1200");
    for (const url of [
        "/api/v1/images/80/content?variant=display",
        "http://localhost:3001/api/v1/images/80/content?variant=display",
        "https://res.cloudinary.com/travel/image/upload/w_1600/cover.jpg",
        "https://images.unsplash.com.example.org/photo-city?w=640",
        "not a URL"
    ]) {
        assert.equal(destinationPhotoUrl(url), url);
    }
});

test("hero and closing photos retain credits while the 1200px Board cover omits its gallery credit", () => {
    const destination = guide();
    destination.boards[0].images = [destination.boards[0].images[1]];
    const markup = renderGuide(destination);
    const images = Array.from(
        markup.matchAll(/<img\b[^>]*\bsrc="([^"]+)"/g),
        ([, src]) => new URL(src.replaceAll("&amp;", "&"))
    );
    for (const [path, width, ixid] of [
        ["/opening.jpg", "3200", "guide-opening"],
        ["/closing.jpg", "3200", "guide-closing"],
        ["/activity.jpg", "1200", "board-cover"]
    ]) {
        const image = images.find((url) => url.pathname === path);
        assert.ok(image, `Missing rendered image ${path}`);
        assert.equal(image.searchParams.get("w"), width);
        assert.equal(image.searchParams.get("q"), "85");
        assert.equal(image.searchParams.get("fit"), "max");
        assert.equal(image.searchParams.get("auto"), "format");
        assert.equal(image.searchParams.get("ixid"), ixid);
        assert.equal(image.searchParams.has("h"), false);
        assert.equal(image.searchParams.has("dpr"), false);
    }
    for (const name of ["Photographer opening", "Photographer closing"]) {
        assert.ok(markup.includes(name));
    }
    for (const source of ["opening", "closing"]) {
        assert.match(markup, new RegExp(`href="https://unsplash\\.com/photos/${source}(?:\\?|"|&)`));
    }
});

test("city search links preserve full identities for any city and distinguish cities with the same name", () => {
    const destinations = [
        city(),
        city({
            name: "São Paulo",
            city: "São Paulo",
            address: "São Paulo, Brazil",
            country: "Brazil",
            countryCode: "BRA",
            latitude: -23.5505,
            longitude: -46.6333
        }),
        city({
            name: "Paris",
            city: "Paris",
            address: "Paris, France",
            country: "France",
            countryCode: "FRA",
            latitude: 48.8566,
            longitude: 2.3522
        }),
        city({
            name: "Paris",
            city: "Paris",
            address: "Paris, Texas, United States",
            country: "United States",
            countryCode: "USA",
            latitude: 33.6609,
            longitude: -95.5555
        })
    ];
    const hrefs = destinations.map((destination) => {
        const href = destinationGuideHref(destination);
        assert.ok(href);
        const url = new URL(href, "http://localhost");
        assert.match(url.pathname, /^\/discover\/destinations\//);
        assert.equal(url.searchParams.get("name"), destination.name);
        assert.equal(url.searchParams.get("country"), destination.countryCode);
        assert.equal(url.searchParams.get("latitude"), String(destination.latitude));
        assert.equal(url.searchParams.get("longitude"), String(destination.longitude));
        assert.deepEqual(
            getDestinationGuideInput(url.pathname.split("/").at(-1)!, Object.fromEntries(url.searchParams)),
            {
                name: destination.name,
                country: destination.countryCode,
                latitude: destination.latitude,
                longitude: destination.longitude
            }
        );
        return href;
    });
    assert.notEqual(hrefs[2], hrefs[3]);
    assert.ok(destinationGuideHref(city({ placeType: "city", city: null })));
    for (const destination of [
        city({ placeType: "poi" }),
        city({ placeType: "neighborhood" }),
        city({ placeType: "country" }),
        city({ countryCode: null }),
        city({ countryCode: "JP" }),
        city({ latitude: Number.NaN })
    ]) {
        assert.equal(destinationGuideHref(destination), undefined);
    }
    assert.equal(getDestinationGuideInput("unknown-city", {}), undefined);
    assert.equal(
        getDestinationGuideInput("unknown-city", { name: "Tokyo", country: "JPN", latitude: "35.6762" }),
        undefined
    );
});

test("the real route opens any selected city, honors query identity over slug and retains three live legacy aliases", async () => {
    for (const slug of ["tokyo", "kyoto"]) {
        const params = Promise.resolve({ slug });
        const searchParams = Promise.resolve({
            name: "Tokyo",
            country: "JPN",
            latitude: "35.6762",
            longitude: "139.6503"
        });
        assert.deepEqual(routeInput(await DestinationRoute({ params, searchParams })), tokyo);
        assert.match(String((await generateMetadata({ params, searchParams })).title), /Tokyo/);
    }
    for (const [slug, name, country, latitude, longitude] of [
        ["kyoto", "Kyoto", "JPN", 35.0116, 135.7681],
        ["paris", "Paris", "FRA", 48.8566, 2.3522],
        ["copenhagen", "Copenhagen", "DNK", 55.6761, 12.5683]
    ] as const) {
        const expected = { name, country, latitude, longitude };
        assert.deepEqual(getDestinationGuideInput(slug, {}), expected);
        assert.deepEqual(
            routeInput(
                await DestinationRoute({ params: Promise.resolve({ slug }), searchParams: Promise.resolve({}) })
            ),
            expected
        );
    }
    assert.match(
        String(
            (await generateMetadata({ params: Promise.resolve({ slug: "japan" }), searchParams: Promise.resolve({}) }))
                .title
        ),
        /Japan/
    );
    await assert.rejects(
        DestinationRoute({ params: Promise.resolve({ slug: "not-a-destination" }), searchParams: Promise.resolve({}) }),
        /404/
    );
});

test("guide reads use the real credentialed API with city identity, page, limit and cancellation", async (t) => {
    const calls: Array<{ url: URL; init?: RequestInit }> = [];
    replaceFetch(t, async (input, init) => {
        calls.push({ url: new URL(String(input)), init });
        return Response.json({ data: guide({ page: 2 }) });
    });
    const signal = new AbortController().signal;
    const result = await loadDestinationGuide(tokyo, 2, signal);
    assert.equal(result.article?.description, "Tokyo is a city in Japan. This opening comes from the matched article.");
    assert.equal(result.boards[0]?.username, "real_traveller");
    assert.equal(result.page, 2);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url.origin, new URL(process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001").origin);
    assert.equal(calls[0].url.pathname, "/api/v1/destinations/guide");
    assert.deepEqual(Object.fromEntries(calls[0].url.searchParams), {
        name: "Tokyo",
        country: "JPN",
        latitude: "35.6762",
        longitude: "139.6503",
        page: "2",
        limit: "6"
    });
    assert.equal(calls[0].init?.credentials, "include");
    assert.equal(calls[0].init?.signal, signal);
});

test("a failed guide read remains retryable through a new API request", async (t) => {
    const state = { fails: true };
    const pages: string[] = [];
    replaceFetch(t, async (input) => {
        pages.push(new URL(String(input)).searchParams.get("page")!);
        return state.fails
            ? Response.json(
                  { error: { code: "UNAVAILABLE", message: "Guide temporarily unavailable" } },
                  { status: 503 }
              )
            : Response.json({ data: guide() });
    });
    await assert.rejects(loadDestinationGuide(tokyo), /Guide temporarily unavailable/);
    state.fails = false;
    assert.equal((await loadDestinationGuide(tokyo)).destination.name, "Tokyo");
    assert.deepEqual(pages, ["1", "1"]);
});

test("live guide content includes Wikivoyage attribution, credited photos and real public Board links", () => {
    const markup = renderGuide();
    assert.match(markup, /Tokyo is a city in Japan\. This opening comes from the matched article\./);
    assert.match(markup, /href="https:\/\/en\.wikivoyage\.org\/wiki\/Tokyo"/);
    assert.match(markup, /CC BY-SA|Creative Commons Attribution.ShareAlike/i);
    assert.match(markup, />Read more on Wikivoyage</);
    assert.match(markup, /Photographer opening/);
    assert.match(markup, /href="https:\/\/unsplash\.com\/@opening/);
    assert.match(markup, /href="https:\/\/unsplash\.com\/photos\/opening/);
    assert.match(markup, /Boards in and around Tokyo/);
    assert.match(markup, /Tokyo evening stations/);
    assert.match(markup, /real_traveller/);
    assert.match(markup, /href="\/boards\/721"/);
    assert.ok(
        markup.includes(
            `src="${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"}/api/v1/images/80/content?variant=display"`
        )
    );
    assert.match(markup, /src="https:\/\/images\.unsplash\.com\/opening\.jpg\?/);
    assert.match(markup, /src="https:\/\/images\.unsplash\.com\/closing\.jpg\?/);
    assert.match(markup, /href="\/boards\/new"/);
    assert.doesNotMatch(
        markup,
        /Editorial sample guide|Sample Boards|Trending boards|id="atlas"|destination-season-note/i
    );
});

test("a guide keeps keyboard access, section targets and source credits", () => {
    const markup = renderGuide();
    const rail = markup.match(/<[^>]+aria-label="Tokyo horizontal destination guide"[^>]*>/)?.[0];
    assert.ok(rail);
    assert.match(rail, /tabindex="0"/);
    for (const chapter of [
        "guide",
        "destination-information",
        "destination-places",
        "destination-boards",
        "destination-create"
    ]) {
        assert.equal((markup.match(new RegExp(`id="${chapter}"`, "g")) ?? []).length, 1);
    }
    assert.match(markup, /<a\b[^>]*href="#destination-boards"[^>]*>Skip to public boards<\/a>/);
    assert.doesNotMatch(markup, /<input\b[^>]*type="range"/);
    assert.match(markup, /href="https:\/\/en\.wikivoyage\.org\/wiki\/Tokyo"/);
    assert.match(markup, /Photographer opening/);
    assert.match(markup, /Photographer closing/);
    assert.match(markup, /href="https:\/\/unsplash\.com\/photos\/opening/);
});

test("four named, focusable chapters retain the Places and public Boards shortcuts", () => {
    const markup = renderGuide();
    const chapterIds = ["guide", "destination-places", "destination-boards", "destination-create"];
    const chapters = Array.from(markup.matchAll(/<(section|header|div)\b[^>]*\bdata-destination-chapter\b[^>]*>/g));
    assert.deepEqual(
        chapters.map(([tag]) => tag.match(/\bid="([^"]+)"/)?.[1]),
        chapterIds
    );
    for (const [tag, element] of chapters) {
        assert.match(tag, /tabindex="-1"/);
        assert.match(tag, /aria-label="[^"]+"|aria-labelledby="[^"]+"/);
        assert.ok(element === "section" || /role="region"/.test(tag), "Every chapter needs region semantics");
    }
    assert.match(markup, /<a\b[^>]*href="#destination-places"[^>]*>[\s\S]*?Explore places on the map/);
    assert.match(markup, /<a\b[^>]*href="#destination-boards"[^>]*>Skip to public boards<\/a>/);
});

test("the small-screen Places and Map controls expose one selected view within the same chapter", () => {
    const markup = renderGuide();
    const buttons = Array.from(markup.matchAll(/<button\b[^>]*>([\s\S]*?)<\/button>/g));
    const places = buttons.find(([, content]) => content.replace(/<[^>]*>/g, "").trim() === "Places");
    const map = buttons.find(([, content]) => content.replace(/<[^>]*>/g, "").trim() === "Map");
    assert.ok(places);
    assert.ok(map);
    assert.match(places[0], /type="button"/);
    assert.match(map[0], /type="button"/);
    assert.match(places[0], /aria-pressed="true"/);
    assert.match(map[0], /aria-pressed="false"/);
    assert.equal((markup.match(/\bdata-destination-chapter\b/g) ?? []).length, 4);
});

test("the introduction omits its creator action and the closing panel starts a city Board", () => {
    const markup = renderGuide();
    const introduction = markup.match(/<header\b[^>]*id="guide"[^>]*>([\s\S]*?)<\/header>/)?.[1];
    assert.ok(introduction);
    assert.doesNotMatch(introduction, /href="\/boards\/new|See Tokyo your way|Tokyo evening stations/);
    const closing = markup.match(/<section\b[^>]*id="destination-create"[^>]*>([\s\S]*?)<\/section>/)?.[1];
    assert.ok(closing);
    const heading = closing.match(/<h2\b[^>]*>([\s\S]*?)<\/h2>/)?.[1];
    assert.ok(heading);
    assert.match(heading.replace(/<[^>]*>/g, ""), /start a Tokyo board/i);
    assert.match(closing, /href="\/boards\/new"/);
    assert.doesNotMatch(closing, /CREATE\s*(?:<[^>]+>\s*)*YOUR\s*(?:<[^>]+>\s*)*OWN/);
    assert.match(markup, /href="\/boards\/721"/);
});

test("long city names remain complete in the opening and closing headings", () => {
    const name = "San Cristóbal de las Casas";
    const markup = renderGuide(
        guide({
            destination: { name, country: "Mexico", countryCode: "MEX", latitude: 16.737, longitude: -92.6376 },
            article: null,
            images: [],
            places: [],
            boards: []
        })
    );
    const heading = markup.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/)?.[1];
    assert.equal(heading, name);
    const closing = markup.match(/<h2\b[^>]*id="destination-create-heading"[^>]*>([\s\S]*?)<\/h2>/)?.[1];
    assert.ok(closing);
    assert.equal(closing.replace(/<[^>]*>/g, ""), `Start a ${name} board`);
    assert.match(markup, /href="\/boards\/new"/);
});

test("travel-guide sights have selectable places and a city map without nearest-place claims", () => {
    const markup = renderGuide();
    const places = markup.match(/<section\b[^>]*id="destination-places"[^>]*>([\s\S]*?)<\/section>/)?.[1];
    assert.ok(places);
    assert.match(places, /Places to explore/);
    const sight = places.match(/<button\b[^>]*aria-label="Explore Senso-ji"[^>]*>[\s\S]*?<\/button>/)?.[0];
    assert.ok(sight);
    assert.match(sight, /aria-pressed="false"/);
    assert.match(sight, /Asakusa, Tokyo, Japan/);
    assert.doesNotMatch(places, />Saved places<\/button>/);
    assert.match(markup, /aria-label="Selected place and city map"/);
    assert.match(markup, /aria-label="City map"/);
    assert.match(markup, /Loading city map/);
    assert.doesNotMatch(places, /Places from public boards|Tokyo Station|Ueno/);
    assert.doesNotMatch(places, /nearest|popular|within 10 km/i);
});

test("destination browsing keeps five travel-guide sights per page without account-save controls or prompts", () => {
    const destination = guide({
        places: Array.from({ length: 10 }, (_, index) => ({
            id: `wikivoyage:98765:sight ${index + 1}`,
            provider: "wikivoyage" as const,
            name: `Sight ${index + 1}`,
            address: "Tokyo, Japan",
            latitude: 35.7 + index * 0.001,
            longitude: 139.7
        }))
    });
    const markup = renderGuide(destination);
    const buttons = [...markup.matchAll(/<button\b[^>]*aria-label="Explore Sight (\d+)"/g)];
    assert.deepEqual(
        buttons.map((match) => Number(match[1])),
        [1, 2, 3, 4, 5]
    );
    assert.match(markup, /aria-label="Next places page"/);
    assert.doesNotMatch(markup, /saved places|save for later|save it for later|sign in to save/i);
    const selected = { ...destination.places[0], city: "Tokyo", country: "JPN" };
    const params = new URL(placeBoardHref(selected), "https://roamboard.example").searchParams;
    assert.equal(params.get("placeId"), selected.id);
    assert.equal(params.get("latitude"), String(selected.latitude));
    assert.equal(params.get("longitude"), String(selected.longitude));
});

test("the city map begins loading before selection, including cities without travel-guide sights", () => {
    for (const places of [guide().places, []]) {
        const markup = renderGuide(guide({ places }));
        const map = markup.match(/<div\b[^>]*aria-label="City map"[^>]*>([\s\S]*?)<\/div>/)?.[1];
        assert.ok(map);
        assert.match(map, /Loading city map/);
        assert.doesNotMatch(map, /Choose a place|Pick a sight|select a place/i);
        const selectedRows = markup.match(/<button\b[^>]*aria-label="Explore [^"]+"[^>]*aria-pressed="true"/g) ?? [];
        assert.equal(selectedRows.length, 0, "Map loading must not require selecting an arbitrary sight");
        if (!places.length) assert.match(markup, /No travel-guide sights are available for Tokyo/);
    }
});

test("travel-guide listing attribution retains the Wikivoyage source and text license", () => {
    const markup = renderGuide(
        guide({
            places: [
                {
                    ...guide().places[0],
                    id: "wikivoyage:98765:sensoji",
                    provider: "wikivoyage"
                }
            ]
        })
    );
    const places = markup.match(/<section\b[^>]*id="destination-places"[^>]*>([\s\S]*?)<\/section>/)?.[1];
    assert.ok(places);
    assert.match(places, /Wikivoyage contributors/);
    assert.match(places, /CC BY-SA 4\.0/);
    assert.match(places, /href="https:\/\/creativecommons\.org\/licenses\/by-sa\/4\.0\//);
    const source = Array.from(
        places.matchAll(/<a\b[^>]*href="([^"]+)"/g),
        ([, href]) => new URL(href.replaceAll("&amp;", "&"), "https://roamboard.example")
    ).find((url) => url.hostname === "en.wikivoyage.org");
    assert.ok(source);
    assert.ok(source.searchParams.get("curid") === "98765" || source.pathname.includes("98765"));
});

test("nearby sights show five selectable rows per page with explicit pagination", () => {
    const places = Array.from({ length: 7 }, (_, index) => ({
        ...guide().places[0],
        id: `sight-${index}`,
        name: `Tokyo sight ${index + 1}`
    }));
    const markup = renderGuide(guide({ places }));
    const names = Array.from(markup.matchAll(/<button\b[^>]*aria-label="Explore ([^"]+)"/g), ([, name]) => name);
    assert.deepEqual(names, ["Tokyo sight 1", "Tokyo sight 2", "Tokyo sight 3", "Tokyo sight 4", "Tokyo sight 5"]);
    const previous = markup.match(/<button\b[^>]*aria-label="Previous places page"[^>]*>/)?.[0];
    const next = markup.match(/<button\b[^>]*aria-label="Next places page"[^>]*>/)?.[0];
    assert.ok(previous);
    assert.ok(next);
    assert.match(previous, /\sdisabled(?:=|[\s>])/);
    assert.doesNotMatch(next, /\sdisabled(?:=|[\s>])/);
    assert.match(markup, /1-5 of 7/);
    assert.match(markup, /aria-label="Recommended places pages"/);
});

test("empty nearby sights and failed sight reads remain distinct without hiding the guide", () => {
    const empty = renderGuide(guide({ places: [] }));
    assert.match(empty, /No [^<]*(?:places|sights)[^<]*(?:found|available)/i);
    assert.doesNotMatch(empty, /(?:Retry|Try again)[^<]*(?:places|sights)/i);
    const failed = renderGuide(guide({ places: [], unavailable: ["places"] }), { onRetry() {} });
    assert.match(failed, /(?:places|sights)[^<]*(?:unavailable|could not|couldn't)|could not[^<]*(?:places|sights)/i);
    assert.match(failed, /<button\b[^>]*>[\s\S]*?(?:Retry|Try again)/i);
    for (const markup of [empty, failed]) {
        assert.match(markup, /Tokyo is a city in Japan/);
        assert.match(markup, /Photographer opening/);
        assert.match(markup, /href="\/boards\/721"/);
        assert.match(markup, /href="\/boards\/new"/);
    }
});

test("public Boards use spatial V4 cards with chosen covers and honest fallbacks when no photo is saved", () => {
    const destination = guide();
    destination.boards.push({ ...destination.boards[0], boardId: 722, title: "Tokyo morning platforms", images: [] });
    const markup = renderGuide(destination);
    const boards = markup.match(/<section\b[^>]*id="destination-boards"[^>]*>([\s\S]*?)<\/section>/)?.[1];
    assert.ok(boards);
    assert.equal((boards.match(/aspect-ratio:400 \/ 500/g) ?? []).length, 2);
    assert.match(boards, /href="\/boards\/721"/);
    assert.match(boards, /aria-label="Select Tokyo morning platforms"/);
    assert.ok(
        boards.includes(
            `src="${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"}/api/v1/images/80/content?variant=display"`
        )
    );
    assert.doesNotMatch(boards, /src="https:\/\/images\.unsplash\.com\/activity\.jpg[?"]/);
    assert.match(boards, /No cover photo/);
    assert.match(boards, /real_traveller/);
});

test("the fixed public Boards chapter keeps every loaded Board reachable in its keyboard gallery", () => {
    const sample = guide().boards[0];
    const boards = Array.from({ length: 12 }, (_, index) => ({
        ...sample,
        boardId: 900 + index,
        title: `Tokyo public trip ${index + 1}`,
        username: `traveller_${index + 1}`
    }));
    const markup = renderGuide(guide({ boards, page: 2, hasMore: true }), { onLoadMore() {} });
    const chapter = markup.match(/<section\b[^>]*id="destination-boards"[^>]*>([\s\S]*?)<\/section>/)?.[1];
    assert.ok(chapter);
    const gallery = chapter.match(/<(?:ol|div)\b[^>]*aria-label="Tokyo public Boards"[^>]*>/)?.[0];
    assert.ok(gallery);
    assert.match(gallery, /tabindex="0"/);
    const selections = Array.from(chapter.matchAll(/<button\b[^>]*aria-label="Select Tokyo public trip (\d+)"[^>]*>/g));
    assert.deepEqual(
        selections.map(([, number]) => Number(number)),
        boards.slice(1).map((_, index) => index + 2)
    );
    for (const [button] of selections) {
        assert.match(button, /tabindex="-1"/);
    }
    const links = Array.from(chapter.matchAll(/<a\b[^>]*href="\/boards\/(\d+)"[^>]*>/g));
    assert.deepEqual([...new Set(links.map(([, id]) => Number(id)))], [boards[0].boardId]);
    assert.doesNotMatch(chapter, />Open Board/);
    assert.match(chapter, /aria-label="Previous slide"/);
    assert.match(chapter, /aria-label="Next slide"/);
    for (const board of boards) assert.ok(chapter.includes(board.username));
    assert.match(chapter, /<button\b[^>]*>Load more boards<\/button>/);
    assert.equal((markup.match(/\bdata-destination-chapter\b/g) ?? []).length, 4);
});

test("a public photo card retains its chosen external cover without a standalone credit", () => {
    const destination = guide();
    destination.boards[0].images = [destination.boards[0].images[1]];
    const markup = renderGuide(destination);
    assert.match(markup, /src="https:\/\/images\.unsplash\.com\/activity\.jpg\?/);
    assert.doesNotMatch(markup, /Ada Rail|href="https:\/\/unsplash\.com\/photos\/activity/);
});

test("missing article and photos retain a guide while a successful empty Board read has an empty state", () => {
    const markup = renderGuide(guide({ article: null, images: [], boards: [] }));
    assert.match(markup, /No public Boards in and around Tokyo yet/);
    assert.match(markup, /(?:introduction|article)[^<]*(?:available|found)|No (?:Wikivoyage )?introduction/i);
    const placeholders = markup.match(/<[^>]+role="img"[^>]*>/g) ?? [];
    assert.ok(placeholders.some((tag) => /Tokyo/.test(tag)));
    assert.match(markup, /href="\/boards\/new"/);
    assert.doesNotMatch(markup, /href="\/boards\/721"|Editorial sample guide/);
});

test("failed public Board reads have retry feedback and keep available article and photos", () => {
    const markup = renderGuide(guide({ boards: [], unavailable: ["boards"] }), { onRetry() {} });
    assert.doesNotMatch(markup, /No public Boards in and around Tokyo yet/);
    assert.match(markup, /(?:Boards[^<]*(?:unavailable|could not|couldn't)|(?:could not|couldn't)[^<]*Boards)/i);
    assert.match(markup, /Try again|Retry/i);
    assert.match(markup, /Tokyo is a city in Japan/);
    assert.match(markup, /Photographer opening/);
});

test("loaded public Boards remain visible beside pagination failures and loading controls", async (t) => {
    replaceFetch(t, async () =>
        Response.json({
            data: guide({
                page: 2,
                boards: [{ ...guide().boards[0], boardId: 722, title: "Tokyo morning platforms" }],
                hasMore: false
            })
        })
    );
    const next = await loadDestinationGuide(tokyo, 2);
    const loaded = guide({ boards: [...guide().boards, ...next.boards], page: next.page, hasMore: next.hasMore });
    const markup = renderGuide(loaded);
    assert.match(markup, /href="\/boards\/721"/);
    assert.match(markup, /aria-label="Select Tokyo morning platforms"/);
    assert.match(markup, /aria-label="Next slide"/);
    const failed = renderGuide(guide({ hasMore: true }), {
        error: "Page two unavailable",
        onLoadMore() {},
        onRetry() {}
    });
    assert.match(failed, /href="\/boards\/721"/);
    assert.match(failed, /Page two unavailable/);
    assert.match(failed, /Try again|Retry/i);
    const loading = renderGuide(guide({ hasMore: true }), { loadingMore: true, onLoadMore() {} });
    assert.match(loading, /href="\/boards\/721"/);
    assert.match(loading, /<button\b[^>]*disabled[^>]*>[\s\S]*?(?:Loading|Load more)/i);
});
