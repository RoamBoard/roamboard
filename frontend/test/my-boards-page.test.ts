import assert from "node:assert/strict";
import test from "node:test";
import { Children, createElement, isValidElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MyBoardsContent } from "../src/components/features/boards/MyBoardsExperience";
import { createMyBoardsStore, type MyBoardsStore } from "../src/lib/my-boards-store";
import type { BoardDocument } from "../src/lib/board-creator-api";

function summary(boardId: number, title = `Journey ${boardId}`) {
    return { boardId, title, status: "published", visibility: "public", updatedAt: "2026-10-15", coverImageUrl: null };
}
function document(boardId: number): BoardDocument {
    return {
        ...summary(boardId),
        status: "published",
        visibility: "public",
        author: { username: "real_owner", bio: "", photo: null },
        revision: 1,
        imageIds: [],
        tagIds: [],
        permissions: { canEditContent: true, canManageBoard: true },
        createdAt: "2026-10-15",
        description: "A real API response",
        coverImageId: null,
        images: [],
        tags: [],
        days: [
            {
                dayId: boardId,
                dayNumber: 1,
                date: null,
                activities: [
                    {
                        activityId: boardId * 10,
                        position: 0,
                        title: "A walk",
                        activityTime: null,
                        category: "walk",
                        note: null,
                        source: "manual",
                        locationConfirmed: true,
                        uploadedImageIds: [],
                        coverImageId: null,
                        location: {
                            name: "A walk",
                            latitude: boardId === 1 ? 35.01 : 59.91,
                            longitude: boardId === 1 ? 135.76 : 10.75,
                            address: null,
                            externalPlaceId: null,
                            city: boardId === 1 ? "Kyoto" : "Oslo",
                            country: boardId === 1 ? "Japan" : "Norway"
                        },
                        externalImage: null
                    }
                ]
            }
        ]
    };
}
function view(store: MyBoardsStore) {
    return MyBoardsContent({ state: store.getSnapshot(), actions: store });
}
function html(store: MyBoardsStore) {
    return renderToStaticMarkup(createElement(MyBoardsContent, { state: store.getSnapshot(), actions: store }));
}

test("the production Boards page features ten loaded Boards while its library retains the full collection", async (t) => {
    t.mock.method(globalThis, "fetch", async (input: string) => {
        const url = new URL(input);
        return Response.json(
            url.search
                ? { data: Array.from({ length: 12 }, (_, index) => summary(index + 1)), meta: { hasMore: false } }
                : { data: document(Number(url.pathname.split("/").at(-1))) }
        );
    });
    const store = createMyBoardsStore();
    await store.load();
    const markup = html(store);
    const featured = markup.match(/<section\b[^>]*aria-labelledby="featured-boards-heading"[\s\S]*?<\/section>/)?.[0];
    assert.ok(featured);
    assert.equal((featured.match(/<article\b/g) ?? []).length, 10);
    assert.match(featured, /01 \/ 10/);
    assert.match(markup, /12 Boards/);
});
type ControlProps = {
    children?: ReactNode;
    id?: string;
    "aria-label"?: string;
    onClick?: () => Promise<void> | void;
    onChange?: (event: { target: { value: string } }) => void;
};
function control(node: ReactNode, matches: (props: ControlProps) => boolean): ControlProps {
    const find = (child: ReactNode): ControlProps | undefined => {
        if (!isValidElement<ControlProps>(child)) return;
        if (matches(child.props)) return child.props;
        return Children.toArray(child.props.children).map(find).find(Boolean);
    };
    const result = find(node);
    assert.ok(result, "Expected the production page control to be present");
    return result;
}

test("page loads through the API helpers, searches via its input handler and clears the filter", async (t) => {
    const calls: string[] = [];
    t.mock.method(globalThis, "fetch", async (input: string, init: RequestInit) => {
        const url = new URL(input);
        calls.push(url.pathname + url.search);
        assert.equal(init.credentials, "include");
        return Response.json(
            url.search
                ? { data: [summary(1), summary(2)], meta: { hasMore: false } }
                : { data: document(Number(url.pathname.split("/").at(-1))) }
        );
    });
    const store = createMyBoardsStore();
    assert.match(html(store), /Loading your Boards/);
    await store.load();
    assert.deepEqual(calls, ["/api/v1/boards?scope=published&page=1", "/api/v1/boards/1", "/api/v1/boards/2"]);
    assert.match(html(store), /Open Journey 1/);
    assert.match(html(store), /href="\/boards\/2"/);
    control(view(store), (props) => props.id === "board-search").onChange?.({ target: { value: "kyoto" } });
    assert.match(html(store), /Open Journey 1/);
    assert.doesNotMatch(html(store), /Open Journey 2/);
    assert.match(html(store), /PUBLIC BOARDS/);
    assert.match(html(store), /Searching public Boards/);
    await control(view(store), (props) => props["aria-label"] === "Clear Board search").onClick?.();
    assert.match(html(store), /Open Journey 2/);
});

test("the existing Boards input searches public Boards and links to another user's Board", async (t) => {
    const calls: string[] = [];
    t.mock.method(globalThis, "fetch", async (input: string) => {
        const url = new URL(input);
        calls.push(url.pathname + url.search);
        if (url.pathname === "/api/v1/search")
            return Response.json({
                data: {
                    hits: [
                        { document: { id: "1", title: "Turkey by me", city: "", country: "Turkey", description: "" } },
                        {
                            document: {
                                id: "9",
                                title: "TURKEY TRIP",
                                city: "Istanbul",
                                country: "Turkey",
                                description: ""
                            }
                        }
                    ],
                    total: 2,
                    page: 1,
                    limit: 10
                }
            });
        if (url.search) return Response.json({ data: [summary(1)], meta: { hasMore: false } });
        return Response.json({ data: document(1) });
    });
    const store = createMyBoardsStore();
    await store.load();
    control(view(store), (props) => props.id === "board-search").onChange?.({ target: { value: "Turkey" } });
    await store.retryPublicSearch();
    assert.ok(calls.some((path) => path.startsWith("/api/v1/search?q=Turkey")));
    assert.match(html(store), /href="\/boards\/9"/);
    assert.match(html(store), /TURKEY TRIP/);
    assert.doesNotMatch(html(store), /Turkey by me/);
    store.cancel();
});

test("a failed initial list shows samples and the page retry button loads account Boards", async (t) => {
    const response = { unavailable: true };
    t.mock.method(globalThis, "fetch", async (input: string) => {
        if (response.unavailable)
            return Response.json({ error: { message: "Temporarily unavailable" } }, { status: 503 });
        return Response.json(
            new URL(input).search ? { data: [summary(7)], meta: { hasMore: false } } : { data: document(7) }
        );
    });
    const store = createMyBoardsStore();
    await store.load();
    assert.match(html(store), /Sample collection/);
    assert.match(html(store), /Temporarily unavailable/);
    response.unavailable = false;
    await control(view(store), (props) => props.children === "try again").onClick?.();
    assert.equal(store.getSnapshot().preview, false);
    assert.match(html(store), /Open Journey 7/);
    assert.doesNotMatch(html(store), /Sample collection/);
});

test("partial document failures retain successful Boards and the page retries only unavailable documents", async (t) => {
    const calls: string[] = [];
    const response = { missing: true };
    t.mock.method(globalThis, "fetch", async (input: string) => {
        const url = new URL(input);
        calls.push(url.pathname + url.search);
        if (url.search) return Response.json({ data: [summary(1), summary(2)], meta: { hasMore: false } });
        if (url.pathname.endsWith("/2") && response.missing)
            return Response.json({ error: { message: "Board deleted" } }, { status: 404 });
        return Response.json({ data: document(Number(url.pathname.split("/").at(-1))) });
    });
    const store = createMyBoardsStore();
    await store.load();
    assert.equal(store.getSnapshot().preview, false);
    assert.match(html(store), /Open Journey 1/);
    assert.match(html(store), /Retry unavailable Boards/);
    assert.doesNotMatch(html(store), /Sample collection/);
    await control(view(store), (props) => props.children === "Retry unavailable Boards").onClick?.();
    assert.match(html(store), /Open Journey 1/);
    assert.equal(store.getSnapshot().failed.length, 1);
    response.missing = false;
    await control(view(store), (props) => props.children === "Retry unavailable Boards").onClick?.();
    assert.match(html(store), /Open Journey 2/);
    assert.equal(store.getSnapshot().failed.length, 0);
    assert.deepEqual(calls.slice(3), ["/api/v1/boards/2", "/api/v1/boards/2"]);
});

test("page pagination retains existing Boards on failure and retries the same next page without duplicates", async (t) => {
    const response = { failPageTwo: true };
    const pages: string[] = [];
    t.mock.method(globalThis, "fetch", async (input: string) => {
        const url = new URL(input);
        if (url.search) {
            const page = url.searchParams.get("page")!;
            pages.push(page);
            if (page === "2" && response.failPageTwo)
                return Response.json({ error: { message: "Page two unavailable" } }, { status: 503 });
            return Response.json({
                data: page === "1" ? [summary(1)] : [summary(1), summary(2)],
                meta: { hasMore: page === "1" }
            });
        }
        return Response.json({ data: document(Number(url.pathname.split("/").at(-1))) });
    });
    const store = createMyBoardsStore();
    await store.load();
    await control(view(store), (props) => props.children === "load more Boards ↓").onClick?.();
    assert.match(html(store), /Open Journey 1/);
    assert.match(html(store), /Page two unavailable/);
    assert.equal(store.getSnapshot().page, 1);
    response.failPageTwo = false;
    await control(view(store), (props) => props.children === "load more Boards ↓").onClick?.();
    assert.deepEqual(pages, ["1", "2", "2"]);
    assert.deepEqual(
        store.getSnapshot().collection.map((board) => board.collage.id),
        ["1", "2"]
    );
    assert.match(html(store), /Open Journey 2/);
    assert.equal(store.getSnapshot().hasMore, false);
    assert.doesNotMatch(html(store), /load more Boards/);
});

test("an empty account renders the creation empty state, while all unavailable documents remain retryable", async (t) => {
    const response = { empty: true };
    t.mock.method(globalThis, "fetch", async (input: string) =>
        new URL(input).search
            ? Response.json({ data: response.empty ? [] : [summary(1)], meta: { hasMore: false } })
            : Response.json({ error: { message: "Unavailable" } }, { status: 404 })
    );
    const store = createMyBoardsStore();
    await store.load();
    assert.match(html(store), /Your next journey starts here/);
    assert.doesNotMatch(html(store), /Sample collection/);
    response.empty = false;
    await store.load();
    assert.match(html(store), /Your Boards couldn’t be displayed/);
    assert.match(html(store), /Retry unavailable Boards/);
    assert.doesNotMatch(html(store), /Sample collection/);
});
