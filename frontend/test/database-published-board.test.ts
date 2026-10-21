import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { Children, createElement, isValidElement, type ComponentProps, type ReactNode } from "react";
import { renderToStaticMarkup as renderMarkup } from "react-dom/server";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import ActivityDetailsDialog from "../src/components/features/boards/ActivityDetailsDialog";
import { DatabasePublishedBoardContent } from "../src/components/features/boards/DatabasePublishedBoard";
import PublishedBoard from "../src/components/features/boards/PublishedBoard";
import StoryGallery from "../src/components/features/boards/StoryGallery";
import StoryPhoto from "../src/components/features/boards/StoryPhoto";
import BoardDayScene from "../src/components/features/boards/BoardDayScene";
import type { BoardDocument } from "../src/lib/board-creator-api";
import { getBoardDays } from "../src/lib/board-presentation";
import { loadPublishedBoard, toPublishedBoardData } from "../src/lib/published-board-data";
import type { PublishedBoardState } from "../src/types/published-board";

const apiOrigin = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

function renderToStaticMarkup(node: ReactNode) {
    return renderMarkup(
        createElement(
            AppRouterContext.Provider,
            {
                value: {
                    bfcacheId: "board-test",
                    back() {},
                    forward() {},
                    refresh() {},
                    push() {},
                    replace() {},
                    prefetch() {}
                }
            },
            node
        )
    );
}

function replaceFetch(t: TestContext, replacement: typeof fetch) {
    const original = globalThis.fetch;
    globalThis.fetch = replacement;
    t.after(() => {
        globalThis.fetch = original;
    });
}

function renderPage(state: PublishedBoardState) {
    const router = {
        back() {},
        forward() {},
        refresh() {},
        push() {},
        replace() {},
        prefetch() {},
        bfcacheId: "viewer-test"
    };
    return renderToStaticMarkup(
        createElement(
            AppRouterContext.Provider,
            { value: router },
            createElement(DatabasePublishedBoardContent, { state, onRetry() {} })
        )
    );
}

function retryButton(node: ReactNode): (() => void) | undefined {
    return Children.toArray(node).flatMap((child): Array<() => void> => {
        if (!isValidElement<{ children?: ReactNode; onClick?: () => void }>(child)) return [];
        if (child.type === "button" && child.props.onClick) return [child.props.onClick];
        const nested = retryButton(child.props.children);
        return nested ? [nested] : [];
    })[0];
}

function descendants(node: ReactNode): Array<{ type: unknown; props: unknown }> {
    return Children.toArray(node).flatMap((child) => {
        if (!isValidElement<{ children?: ReactNode }>(child)) return [];
        return [{ type: child.type, props: child.props }, ...descendants(child.props.children)];
    });
}

// Empty days and differently ordered photos make accidental data loss in the adapter visible.
function document(): BoardDocument {
    return {
        boardId: 718,
        revision: 3,
        status: "published",
        title: "Railway weekend",
        description: "Notes from a real Board.",
        visibility: "friends",
        isCompleted: true,
        coverImageId: 92,
        savedCount: 0,
        commentCount: 27,
        fillerImagesEnabled: false,
        fillerImages: [],
        fillerImageStatus: "disabled",
        tagIds: [4],
        imageIds: [91, 92],
        tags: [{ tagId: 4, name: "Architecture" }],
        author: {
            username: "station_walker",
            bio: "I photograph railway stations.",
            photo: { imageId: 93, url: "/api/v1/images/93/content?variant=display&boardId=718" }
        },
        images: [
            {
                imageId: 91,
                url: "/api/v1/images/91/content?variant=display",
                thumbnailUrl: "/api/v1/images/91/content?variant=thumbnail",
                largeUrl: "/api/v1/images/91/content?variant=large",
                capturedAt: null,
                position: 0
            },
            {
                imageId: 92,
                url: "/api/v1/images/92/content?variant=display",
                thumbnailUrl: "/api/v1/images/92/content?variant=thumbnail",
                largeUrl: "/api/v1/images/92/content?variant=large",
                capturedAt: "2026-10-15T10:00:00Z",
                position: 1
            }
        ],
        permissions: { canEditContent: true, canManageBoard: false },
        createdAt: "2026-10-14T09:00:00Z",
        updatedAt: "2026-10-15T12:00:00Z",
        days: [
            { dayId: 11, dayNumber: 1, date: null, activities: [] },
            {
                dayId: 12,
                dayNumber: 2,
                date: "2026-10-15",
                activities: [
                    {
                        activityId: 801,
                        position: 0,
                        title: "Saved first, later in the day",
                        activityTime: "18:00",
                        category: "city",
                        note: "Use the west entrance.",
                        source: "manual",
                        uploadedImageIds: [91, 92],
                        coverImageId: 92,
                        locationConfirmed: true,
                        location: {
                            name: "Stockholm Central",
                            latitude: 59.33,
                            longitude: 18.058,
                            city: "Stockholm",
                            country: "Sweden",
                            address: "Centralplan 15",
                            externalPlaceId: null
                        },
                        externalImage: {
                            provider: "unsplash",
                            providerImageId: "station-portrait",
                            url: "https://images.unsplash.com/station.jpg",
                            photographer: "Ada Rail",
                            photographerUrl: "https://unsplash.com/@adarail",
                            sourceUrl: "https://unsplash.com/photos/station-portrait"
                        }
                    },
                    {
                        activityId: 802,
                        position: 1,
                        title: "Saved second, earlier in the day",
                        activityTime: "08:00",
                        category: "city",
                        note: null,
                        source: "manual",
                        uploadedImageIds: [],
                        coverImageId: null,
                        locationConfirmed: false,
                        location: null,
                        externalImage: null
                    }
                ]
            },
            { dayId: 15, dayNumber: 5, date: null, activities: [] }
        ]
    };
}

test("viewer labels current saves, exposes a text save button and counts activities rather than unique places", () => {
    const saved = document();
    const first = saved.days[1].activities[0];
    saved.days[1].activities = [first, { ...first, activityId: 999, position: 1 }];
    for (const count of [0, 1, 27]) {
        const data = toPublishedBoardData({ ...saved, savedCount: count });
        assert.equal(data.savedCount, count);
        const markup = renderToStaticMarkup(createElement(PublishedBoard, data));
        assert.match(markup, /aria-label="Save Board"/);
        assert.match(markup, /<button\b[^>]*aria-label="Save Board"[^>]*>[\s\S]*?Save Board/);
        assert.match(markup, new RegExp(`aria-label="${count} ${count === 1 ? "save" : "saves"}"`));
        assert.match(markup, /<dd[^>]*>2<\/dd><dt[^>]*>activities<\/dt>/);
        assert.doesNotMatch(markup, />places<\/dt>/);
    }
    const savedMarkup = renderToStaticMarkup(
        createElement(PublishedBoard, toPublishedBoardData({ ...saved, savedByMe: true, savedCount: 1 }))
    );
    assert.match(savedMarkup, /<button\b(?=[^>]*aria-label="Unsave Board")(?=[^>]*aria-pressed="true")[^>]*>/);
    const ownerMarkup = renderToStaticMarkup(
        createElement(
            PublishedBoard,
            toPublishedBoardData({
                ...saved,
                permissions: { canEditContent: true, canManageBoard: true },
                savedCount: 27
            })
        )
    );
    assert.match(ownerMarkup, /aria-label="27 saves"/);
    assert.doesNotMatch(ownerMarkup, /aria-label="Save Board"/);
});

test("the viewer saves once on repeated activation and refreshes the canonical count with session credentials", async (t) => {
    const calls: string[] = [];
    replaceFetch(t, async (input, init) => {
        assert.equal(init?.credentials, "include");
        const method = init?.method ?? "GET";
        calls.push(`${method} ${new URL(String(input)).pathname}`);
        return Response.json({
            data: method === "PUT" ? { boardId: 718, saved: true } : { ...document(), savedByMe: true, savedCount: 2 }
        });
    });
    const captured: { tree: ReactNode } = { tree: null };
    function Probe() {
        captured.tree = PublishedBoard(toPublishedBoardData({ ...document(), savedCount: 1 }));
        return captured.tree;
    }
    renderToStaticMarkup(createElement(Probe));
    const save = retryButton(captured.tree);
    assert.ok(save);
    await Promise.all([save(), save()]);
    assert.deepEqual(calls, ["PUT /api/v1/boards/718/save", "GET /api/v1/boards/718"]);
});

test("database presentation keeps the stored author, cover, empty numbered days and saved activity order", () => {
    const source = document();
    const before = structuredClone(source);
    const result = toPublishedBoardData(source);
    assert.equal(result.board.id, "718");
    assert.equal(result.board.title, "Railway weekend");
    assert.equal(result.board.visibility, "friends");
    assert.equal(result.board.isCompleted, true);
    assert.equal(result.board.coverImage?.url, `${apiOrigin}/api/v1/images/92/content?variant=display`);
    assert.equal(result.author.name, "station_walker");
    assert.equal(result.author.bio, "I photograph railway stations.");
    assert.equal(result.author.photo?.url, `${apiOrigin}/api/v1/images/93/content?variant=display&boardId=718`);
    assert.deepEqual(result.tagLabels, ["Architecture"]);
    assert.equal(result.canEditContent, true);
    assert.deepEqual(
        getBoardDays(result.board).map((day) => ({
            number: day.number,
            titles: day.items.filter((item) => item.type === "activity").map((item) => item.title)
        })),
        [
            { number: 1, titles: [] },
            { number: 2, titles: ["Saved first, later in the day", "Saved second, earlier in the day"] },
            { number: 5, titles: [] }
        ]
    );
    assert.deepEqual(source, before);
});

test("saved calendar dates survive grouping for populated and empty days without dating undated days", () => {
    const source = document();
    source.days[0].date = "2026-10-14";
    const before = structuredClone(source);
    const result = toPublishedBoardData(source);
    assert.deepEqual(
        getBoardDays(result.board).map((day) => ({ number: day.number, date: day.date })),
        [
            { number: 1, date: "2026-10-14" },
            { number: 2, date: "2026-10-15" },
            { number: 5, date: undefined }
        ]
    );
    assert.deepEqual(source, before);
});

test("published day headings show exact saved dates even on empty days and leave undated headings undated", () => {
    const source = document();
    source.days[0].date = "2026-10-14";
    const markup = renderToStaticMarkup(createElement(PublishedBoard, toPublishedBoardData(source)));
    const header = (number: number) => {
        const match = markup.match(
            new RegExp(
                `<section\\b[^>]*aria-labelledby="day-${number}-heading"[^>]*>[\\s\\S]*?<header\\b[^>]*>([\\s\\S]*?)<\\/header>`
            )
        );
        assert.ok(match, `Day ${number} must have a heading`);
        return match[1];
    };
    assert.match(header(1), /<time\b[^>]*datetime="2026-10-14"[^>]*>\s*2026-10-14\s*<\/time>/i);
    assert.match(header(2), /<time\b[^>]*datetime="2026-10-15"[^>]*>\s*2026-10-15\s*<\/time>/i);
    assert.doesNotMatch(header(5), /<time\b|2026-10-/i);
});

test("the story ending and comments remain available to visitors and owners without browser-only copy promotions", () => {
    const source = document();
    const visitor = renderPage({ status: "ready", data: toPublishedBoardData(source) });
    assert.doesNotMatch(visitor, /Make it yours|Copy board preview|copies are previews/i);
    assert.match(visitor, /id="ending"/i);
    assert.match(visitor, /href="\/profile\/station_walker"/);
    assert.match(visitor, /I photograph railway stations\./);
    assert.match(visitor, /id="comments"/i);
    assert.ok(visitor.indexOf('id="ending"') < visitor.indexOf('id="comments"'));

    source.permissions = { canEditContent: true, canManageBoard: true };
    const owner = renderPage({ status: "ready", data: toPublishedBoardData(source) });
    assert.doesNotMatch(owner, /Make it yours|Copy board preview|copies are previews/i);
    assert.match(owner, /id="ending"/i);
    assert.match(owner, /Edit Board/i);
    assert.match(owner, /id="comments"/i);
});

test("activity details show their saved day date and retain the activity time without dating undated activities", () => {
    const source = document();
    const renderDetails = () => {
        const data = toPublishedBoardData(source);
        const activity = data.board.items.find((item) => item.type === "activity");
        assert.ok(activity?.type === "activity");
        return renderToStaticMarkup(
            ActivityDetailsDialog({
                activity,
                days: getBoardDays(data.board),
                onClose() {},
                onOpenPhoto() {},
                onFocusLocation() {}
            })
        );
    };
    const dated = renderDetails();
    assert.match(dated, /2026-10-15/);
    assert.match(dated, /18:00/);
    source.days[1].date = null;
    assert.doesNotMatch(renderDetails(), /datetime="\d{4}-\d{2}-\d{2}"|2026-10-15/i);
});

for (const [visibility, label] of [
    ["public", /Public Board|Anyone/],
    ["friends", /Friends and invited members/],
    ["collaborators", /Invited members/],
    ["private", /Only you/]
] as const) {
    test(`the published header explains ${visibility} access`, () => {
        const data = toPublishedBoardData(document());
        data.board.visibility = visibility;
        const markup = renderToStaticMarkup(createElement(PublishedBoard, data));
        const overview = markup.match(/<(?:section|header)\b[^>]*id="overview"[^>]*>([\s\S]*?)<\/(?:section|header)>/);
        assert.ok(overview);
        const text = overview[1].replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");
        assert.match(text, label);
    });
}

test("activity images show the chosen upload first and retain saved photo order and Unsplash credit", () => {
    const result = toPublishedBoardData(document());
    const activity = result.board.items.find((item) => item.type === "activity");
    assert.ok(activity?.type === "activity");
    assert.equal(activity.description, "Use the west entrance.");
    assert.equal(activity.time, "18:00");
    assert.equal(activity.location?.name, "Stockholm Central");
    assert.equal(activity.location?.latitude, 59.33);
    assert.deepEqual(
        activity.images.map((image) => image.url),
        [
            `${apiOrigin}/api/v1/images/92/content?variant=display`,
            `${apiOrigin}/api/v1/images/91/content?variant=display`,
            "https://images.unsplash.com/station.jpg"
        ]
    );
    assert.equal(activity.images[2]?.photographer, "Ada Rail");
    assert.equal(activity.images[2]?.photographerUrl, "https://unsplash.com/@adarail");
    assert.equal(activity.images[2]?.sourceUrl, "https://unsplash.com/photos/station-portrait");
});

test("missing author bio and photo stay empty and collaborator visibility is preserved", () => {
    const source = document();
    source.author = { username: "quiet_user", bio: "", photo: null };
    source.visibility = "collaborators";
    source.description = null;
    source.coverImageId = null;
    source.images = [];
    source.imageIds = [];
    source.days = [{ dayId: 1, dayNumber: 1, date: null, activities: [] }];
    const result = toPublishedBoardData(source);
    assert.equal(result.author.name, "quiet_user");
    assert.equal(result.author.bio, "");
    assert.equal(result.author.photo, undefined);
    assert.equal(result.board.coverImage, undefined);
    assert.equal(result.board.description, "");
    assert.equal(result.board.visibility, "collaborators");
    assert.deepEqual(result.board.items, []);
});

test("database viewer renders real content without the persistent activity preview notice", () => {
    const markup = renderToStaticMarkup(createElement(PublishedBoard, toPublishedBoardData(document())));
    assert.match(markup, /Railway weekend/);
    assert.match(markup, /station_walker/);
    assert.match(markup, /I photograph railway stations\./);
    assert.match(markup, /Architecture/);
    assert.match(markup, /Saved first, later in the day/);
    assert.doesNotMatch(markup, /Activity saves and copies are previews saved in this tab/);
    assert.doesNotMatch(markup, /sample board and author/i);
    assert.match(markup, /href="\/boards\/718\/edit"/);
});

test("an author without a photo retains the linked identity without inventing a portrait", () => {
    const source = document();
    source.author = { username: "station_walker", bio: "I photograph railway stations.", photo: null };
    const markup = renderToStaticMarkup(createElement(PublishedBoard, toPublishedBoardData(source)));
    assert.match(markup, /href="\/profile\/station_walker"/);
    assert.match(markup, /station_walker/);
    assert.doesNotMatch(markup, /alt="station_walker"/);
    assert.doesNotMatch(markup, /\/api\/v1\/images\/93\/content/);
});

test("a supplied current author photo renders with the protected Board context", () => {
    const markup = renderToStaticMarkup(createElement(PublishedBoard, toPublishedBoardData(document())));
    assert.match(markup, /alt="station_walker"/);
    assert.match(markup, /src="[^"]*\/api\/v1\/images\/93\/content\?variant=display&amp;boardId=718"/);
});

test("activity details render Unsplash attribution with the saved photo and photographer links", () => {
    const result = toPublishedBoardData(document());
    const activity = result.board.items.find((item) => item.type === "activity");
    assert.ok(activity?.type === "activity");
    const markup = renderToStaticMarkup(
        ActivityDetailsDialog({
            activity,
            days: getBoardDays(result.board),
            onClose() {},
            onOpenPhoto() {},
            onFocusLocation() {}
        })
    );
    assert.match(markup, /Ada Rail/);
    assert.match(markup, /href="https:\/\/unsplash\.com\/@adarail"/);
    assert.match(markup, /href="https:\/\/unsplash\.com\/photos\/station-portrait"/);
});

test("the story preserves addressable chapters, empty days and its ending before the comments section", () => {
    const markup = renderToStaticMarkup(createElement(PublishedBoard, toPublishedBoardData(document())));
    for (const id of ["overview", "day-1", "day-2", "day-5", "ending", "comments"]) {
        assert.match(markup, new RegExp(`id="${id}"`));
        assert.match(markup, new RegExp(`href="#${id}"`));
    }
    assert.match(markup, /No activities are recorded for this day/);
    assert.ok(markup.indexOf('id="day-1"') < markup.indexOf('id="day-2"'));
    assert.ok(markup.indexOf('id="day-2"') < markup.indexOf('id="day-5"'));
    assert.ok(markup.indexOf('id="day-5"') < markup.indexOf('id="ending"'));
    assert.ok(markup.indexOf('id="ending"') < markup.indexOf('id="comments"'));
    assert.doesNotMatch(markup, /Copy board preview|Make it yours|Save activity preview/);
});

test("story excerpts preserve complete notes in activity details and keep notes out of the enlarged gallery", () => {
    const source = document();
    const note = `${"A useful detail. ".repeat(16)}Complete-note-only ending.`;
    source.days[1].activities[0].note = note;
    const data = toPublishedBoardData(source);
    const activity = data.board.items.find((item) => item.type === "activity");
    assert.ok(activity?.type === "activity");
    const story = renderToStaticMarkup(createElement(PublishedBoard, data));
    assert.match(story, /A useful detail/);
    assert.doesNotMatch(story, /Complete-note-only ending/);
    const details = renderToStaticMarkup(
        createElement(ActivityDetailsDialog, {
            activity,
            days: getBoardDays(data.board),
            onClose() {},
            onOpenPhoto() {},
            onFocusLocation() {}
        })
    );
    assert.match(details, /Complete-note-only ending/);
    const gallery = renderToStaticMarkup(
        createElement(StoryGallery, {
            placements: activity.images.map((image, index) => ({ id: `photo-${index}`, image })),
            initialIndex: 2,
            onClose() {}
        })
    );
    assert.doesNotMatch(gallery, /A useful detail|Complete-note-only ending/);
    assert.match(gallery, /Ada Rail/);
    assert.match(gallery, /aria-label="Previous photo"/);
    assert.match(gallery, /aria-label="Next photo"/);
    assert.match(gallery, /aria-label="Close enlarged view"/);
});

test("photo clicks open the matching story placement with all displayed photos and exclude portraits and unattached uploads", () => {
    const source = document();
    source.imageIds.push(94);
    source.images.push({
        imageId: 94,
        position: 2,
        url: "/api/v1/images/94/content?variant=display",
        thumbnailUrl: "/api/v1/images/94/content?variant=thumbnail",
        capturedAt: null
    });
    source.fillerImagesEnabled = true;
    source.fillerImageStatus = "partial";
    source.fillerImages = [
        {
            provider: "unsplash",
            providerImageId: "destination-filler",
            position: 0,
            url: "https://images.unsplash.com/destination-filler?w=1600",
            thumbnailUrl: "https://images.unsplash.com/destination-filler?w=320",
            largeUrl: "https://images.unsplash.com/destination-filler?w=4096",
            width: 6000,
            height: 4000,
            alt: "Destination illustration",
            photographer: "Destination Photographer",
            photographerUrl: "https://unsplash.com/@destination",
            sourceUrl: "https://unsplash.com/photos/destination-filler"
        }
    ];
    const captured: { gallery?: ComponentProps<typeof StoryGallery>; clicked: boolean } = { clicked: false };
    function Probe() {
        const tree = PublishedBoard(toPublishedBoardData(source));
        const nodes = descendants(tree);
        if (!captured.clicked) {
            const scene = nodes.find(
                (node) =>
                    node.type === BoardDayScene &&
                    (node.props as ComponentProps<typeof BoardDayScene>).scene.day.number === 2
            );
            assert.ok(scene);
            const sceneProps = scene.props as ComponentProps<typeof BoardDayScene>;
            assert.equal(
                sceneProps.scene.photos.length,
                4,
                "Every activity photo and the illustration must be in the day scene"
            );
            assert.equal(
                nodes.filter((node) => node.type === StoryPhoto).length,
                1,
                "The overview keeps its separate cover placement"
            );
            captured.clicked = true;
            const sceneNodes = descendants(BoardDayScene(sceneProps));
            const activityCover = sceneNodes.find((node) => node.type === StoryPhoto)?.props as ComponentProps<
                typeof StoryPhoto
            >;
            assert.ok(activityCover);
            activityCover.onOpen();
        }
        const gallery = nodes.find((node) => node.type === StoryGallery);
        if (gallery) captured.gallery = gallery.props as ComponentProps<typeof StoryGallery>;
        return tree;
    }
    renderToStaticMarkup(createElement(Probe));
    assert.ok(captured.gallery);
    assert.equal(captured.gallery.initialIndex, 1, "Reused cover must open its clicked activity placement");
    const placements = captured.gallery.placements;
    assert.equal(new Set(placements.map((placement) => placement.id)).size, 5);
    assert.deepEqual(
        placements.map((placement) => placement.image.url),
        [
            `${apiOrigin}/api/v1/images/92/content?variant=display`,
            `${apiOrigin}/api/v1/images/92/content?variant=display`,
            `${apiOrigin}/api/v1/images/91/content?variant=display`,
            "https://images.unsplash.com/station.jpg",
            "https://images.unsplash.com/destination-filler?w=1600"
        ]
    );
    assert.ok(placements.every((placement) => !/\/images\/(93|94)\//.test(placement.image.url)));
});

test("the published Board loader uses the real endpoint with session credentials and supplies the ready view", async (t) => {
    const calls: Array<{ input: string; init?: RequestInit }> = [];
    const pending: { resolve?: (response: Response) => void } = {};
    replaceFetch(t, (input, init) => {
        calls.push({ input: String(input), init });
        return new Promise<Response>((resolve) => {
            pending.resolve = resolve;
        });
    });
    const loading = renderPage({ status: "loading", data: null });
    assert.match(loading, /Loading/);
    assert.doesNotMatch(loading, /Railway weekend|Lost in Tokyo/i);
    const request = loadPublishedBoard("718");
    assert.equal(calls.length, 1);
    pending.resolve!(Response.json({ data: document() }));
    const result = await request;
    assert.equal(result.status, "ready");
    assert.equal(result.data?.board.title, "Railway weekend");
    assert.equal(calls[0]?.input, `${apiOrigin}/api/v1/boards/718`);
    assert.equal(calls[0]?.init?.credentials, "include");
    assert.equal(calls[0]?.init?.cache, "no-store");
    const ready = renderPage(result);
    assert.match(ready, /Railway weekend/);
    assert.match(ready, /station_walker/);
});

for (const [status, expected] of [
    [401, "unauthenticated"],
    [403, "forbidden"],
    [404, "not-found"],
    [503, "error"]
] as const) {
    test(`HTTP ${status} produces ${expected} without showing sample content`, async (t) => {
        replaceFetch(t, async () =>
            Response.json({ error: { code: "TEST_ERROR", message: "Unavailable" } }, { status })
        );
        const result = await loadPublishedBoard("718");
        assert.equal(result.status, expected);
        assert.equal(result.data, null);
        const markup = renderPage(result);
        assert.match(
            markup,
            status === 401
                ? /href="\/login"/
                : status === 403
                  ? /access denied/i
                  : status === 404
                    ? /not found/i
                    : /try again/i
        );
        assert.doesNotMatch(markup, /Railway weekend|Lost in Tokyo|sample board and author/i);
    });
}

test("network failures remain retryable through a fresh real API request", async (t) => {
    const response = { fails: true };
    const requests: string[] = [];
    replaceFetch(t, async (input) => {
        requests.push(String(input));
        if (response.fails) throw new TypeError("Network unavailable");
        return Response.json({ data: document() });
    });
    const failed = await loadPublishedBoard("718");
    assert.equal(failed.status, "error");
    assert.equal(failed.data, null);
    response.fails = false;
    const pending: { retry?: Promise<PublishedBoardState> } = {};
    const view = DatabasePublishedBoardContent({
        state: failed,
        onRetry: () => {
            pending.retry = loadPublishedBoard("718");
        }
    });
    const handler = retryButton(view);
    assert.ok(handler);
    handler();
    assert.ok(pending.retry);
    const ready = await pending.retry;
    assert.equal(ready.status, "ready");
    assert.equal(ready.data?.author.name, "station_walker");
    assert.match(renderPage(ready), /Railway weekend/);
    assert.deepEqual(requests, [`${apiOrigin}/api/v1/boards/718`, `${apiOrigin}/api/v1/boards/718`]);
});

test("owner-readable drafts never render in the published viewer", async (t) => {
    replaceFetch(t, async () => Response.json({ data: { ...document(), status: "draft" } }));
    const result = await loadPublishedBoard("718");
    assert.deepEqual(result, { status: "not-found", data: null });
});

test("invalid database IDs never request a Board or display saved content", async (t) => {
    const requests: string[] = [];
    replaceFetch(t, async (input) => {
        requests.push(String(input));
        return Response.json({ data: document() });
    });
    for (const id of ["0", "-1", "1.5", "2147483648", "lost-in-tokyo"]) {
        assert.deepEqual(await loadPublishedBoard(id), { status: "not-found", data: null });
    }
    assert.deepEqual(requests, []);
});
