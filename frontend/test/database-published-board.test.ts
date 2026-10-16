import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { Children, createElement, isValidElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import ActivityDetailsDialog from "../src/components/features/boards/ActivityDetailsDialog";
import { DatabasePublishedBoardContent } from "../src/components/features/boards/DatabasePublishedBoard";
import PublishedBoard from "../src/components/features/boards/PublishedBoard";
import type { BoardDocument } from "../src/lib/board-creator-api";
import { getBoardDays } from "../src/lib/board-presentation";
import { toPublishedBoardData } from "../src/lib/published-board-data";
import { createPublishedBoardStore } from "../src/lib/published-board-store";

const apiOrigin = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

function replaceFetch(t: TestContext, replacement: typeof fetch) {
    const original = globalThis.fetch;
    globalThis.fetch = replacement;
    t.after(() => {
        globalThis.fetch = original;
    });
}

function renderPage(state: ReturnType<ReturnType<typeof createPublishedBoardStore>["getSnapshot"]>) {
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
                capturedAt: null,
                position: 0
            },
            {
                imageId: 92,
                url: "/api/v1/images/92/content?variant=display",
                thumbnailUrl: "/api/v1/images/92/content?variant=thumbnail",
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
    assert.equal(result.author.countriesVisited, undefined);
    assert.equal(result.author.boardsCreated, undefined);
    assert.deepEqual(result.highlights, []);
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

test("database viewer renders real content and identifies save and copy actions as tab previews", () => {
    const markup = renderToStaticMarkup(createElement(PublishedBoard, toPublishedBoardData(document())));
    assert.match(markup, /Railway weekend/);
    assert.match(markup, /station_walker/);
    assert.match(markup, /I photograph railway stations\./);
    assert.match(markup, /Architecture/);
    assert.match(markup, /Saved first, later in the day/);
    assert.match(markup, /(?:tab[^<]*preview|preview[^<]*tab|stay[^<]*tab)/i);
    assert.doesNotMatch(markup, /sample board and author|countries visited|boards created|>Highlights</i);
    assert.match(markup, /href="\/boards\/718\/edit"/);
});

test("activity details render Unsplash attribution with the saved photo and photographer links", () => {
    const result = toPublishedBoardData(document());
    const activity = result.board.items.find((item) => item.type === "activity");
    assert.ok(activity?.type === "activity");
    const markup = renderToStaticMarkup(
        ActivityDetailsDialog({
            activity,
            days: getBoardDays(result.board),
            saved: false,
            onClose() {},
            onSave() {},
            onCopy() {},
            children: null
        })
    );
    assert.match(markup, /Ada Rail/);
    assert.match(markup, /href="https:\/\/unsplash\.com\/@adarail"/);
    assert.match(markup, /href="https:\/\/unsplash\.com\/photos\/station-portrait"/);
});

test("store loads the actual Board endpoint with session credentials and suppresses concurrent requests", async (t) => {
    const calls: Array<{ input: string; init?: RequestInit }> = [];
    const pending: { resolve?: (response: Response) => void } = {};
    replaceFetch(t, (input, init) => {
        calls.push({ input: String(input), init });
        return new Promise<Response>((resolve) => {
            pending.resolve = resolve;
        });
    });
    const store = createPublishedBoardStore("718");
    assert.deepEqual(store.getSnapshot(), { status: "loading", data: null });
    const loading = renderPage(store.getSnapshot());
    assert.match(loading, /Loading/);
    assert.doesNotMatch(loading, /Railway weekend|Lost in Tokyo/i);
    const seen: string[] = [];
    const unsubscribe = store.subscribe(() => {
        seen.push(store.getSnapshot().status);
    });
    const first = store.load();
    const second = store.load();
    assert.equal(store.getSnapshot().status, "loading");
    assert.equal(calls.length, 1);
    pending.resolve!(Response.json({ data: document() }));
    await Promise.all([first, second]);
    assert.equal(store.getSnapshot().status, "ready");
    assert.equal(store.getSnapshot().data?.board.title, "Railway weekend");
    assert.equal(calls[0]?.input, `${apiOrigin}/api/v1/boards/718`);
    assert.equal(calls[0]?.init?.credentials, "include");
    assert.equal(calls[0]?.init?.cache, "no-store");
    assert.ok(seen.includes("ready"));
    const ready = renderPage(store.getSnapshot());
    assert.match(ready, /Railway weekend/);
    assert.match(ready, /station_walker/);
    unsubscribe();
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
        const store = createPublishedBoardStore("718");
        await store.load();
        assert.equal(store.getSnapshot().status, expected);
        assert.equal(store.getSnapshot().data, null);
        const markup = renderPage(store.getSnapshot());
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
    replaceFetch(t, async () => {
        if (response.fails) throw new TypeError("Network unavailable");
        return Response.json({ data: document() });
    });
    const store = createPublishedBoardStore("718");
    await store.load();
    assert.equal(store.getSnapshot().status, "error");
    assert.equal(store.getSnapshot().data, null);
    response.fails = false;
    const view = DatabasePublishedBoardContent({
        state: store.getSnapshot(),
        onRetry: () => {
            void store.load();
        }
    });
    const handler = retryButton(view);
    assert.ok(handler);
    const ready = new Promise<void>((resolve) => {
        const unsubscribe = store.subscribe(() => {
            if (store.getSnapshot().status === "ready") {
                unsubscribe();
                resolve();
            }
        });
    });
    handler();
    assert.equal(store.getSnapshot().status, "loading");
    await ready;
    assert.equal(store.getSnapshot().status, "ready");
    assert.equal(store.getSnapshot().data?.author.name, "station_walker");
});

test("owner-readable drafts never render in the published viewer", async (t) => {
    replaceFetch(t, async () => Response.json({ data: { ...document(), status: "draft" } }));
    const store = createPublishedBoardStore("718");
    await store.load();
    assert.equal(store.getSnapshot().status, "not-found");
    assert.equal(store.getSnapshot().data, null);
});
