import assert from "node:assert/strict";
import test from "node:test";
import { Children, createElement, isValidElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MyBoardsContent } from "../src/components/features/boards/MyBoardsExperience";
import { createMyBoardsStore, type MyBoardsStore } from "../src/lib/my-boards-store";

function summary(boardId: number, title = `Journey ${boardId}`) {
    return { boardId, title, status: "published", visibility: "public", updatedAt: "2026-10-15", coverImageUrl: null };
}
function document(boardId: number) {
    return {
        ...summary(boardId),
        description: "A real API response",
        coverImageId: null,
        images: [],
        tags: [],
        days: [
            {
                dayNumber: 1,
                activities: [
                    {
                        title: "A walk",
                        location: {
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
    await control(view(store), (props) => props["aria-label"] === "Clear Board search").onClick?.();
    assert.match(html(store), /Open Journey 2/);
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
