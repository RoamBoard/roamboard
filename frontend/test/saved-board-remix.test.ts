import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import React, { Children, createElement, isValidElement, type ComponentProps, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createBoardSelectionStore } from "../src/lib/board-selection-store";
import { toSelectionBoard } from "../src/lib/board-selection";
import {
    BoardSelectionCollection,
    BoardSelectionGallery
} from "../src/components/features/boards/BoardSelectionGallery";
import { PhotoBoardCardContent } from "../src/components/features/boards/cards/PhotoBoardCard";
import {
    fromBoardDocument,
    prepareBoardRemix,
    saveBoardDocument,
    toBoardWrite,
    type BoardDocument,
    type PreparedBoardCopy
} from "../src/lib/board-creator-api";

const saved = (boardId: number) => ({
    boardId,
    title: `Saved journey ${boardId}`,
    description: "A saved journey",
    owner: { id: "original", username: "original", displayName: "Original author" },
    coverImageUrl: null,
    savedAt: `2026-10-${boardId === 91 ? "19" : "18"}T12:00:00Z`
});

function document(): BoardDocument {
    return {
        boardId: 91,
        revision: 3,
        status: "published",
        title: "Saved journey 91",
        description: "Notes",
        visibility: "public",
        savedByMe: true,
        author: { username: "original", bio: "", photo: null },
        permissions: { canEditContent: false, canManageBoard: false },
        createdAt: "2026-10-01T12:00:00Z",
        updatedAt: "2026-10-02T12:00:00Z",
        tags: [],
        tagIds: [],
        imageIds: [],
        images: [],
        coverImageId: null,
        days: []
    };
}

async function content() {
    const modules = createRequire(import.meta.url);
    const previous = modules.extensions[".css"];
    modules.extensions[".css"] = (module) => {
        module.exports = {};
    };
    try {
        return (await import("../src/components/features/boards/BoardSelectionExperience")).BoardSelectionContent;
    } finally {
        if (previous) modules.extensions[".css"] = previous;
        else delete modules.extensions[".css"];
    }
}

test("Saved Board creation loads the user's saved collection, paginates it and previews readable non-owned Boards", async (t) => {
    const requests: string[] = [];
    t.mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
        const url = new URL(String(input));
        assert.equal(init?.credentials, "include");
        assert.equal(init?.cache, "no-store");
        requests.push(url.pathname + url.search);
        if (url.pathname === "/api/v1/boards/91") return Response.json({ data: document() });
        assert.equal(url.pathname, "/api/v1/users/me/saved-boards");
        const page = Number(url.searchParams.get("page"));
        return Response.json({ data: [saved(page === 1 ? 91 : 92)], meta: { hasMore: page === 1 } });
    });
    const store = createBoardSelectionStore(undefined, "remix");
    t.after(store.cancel);
    await store.load();
    assert.deepEqual(
        store.getSnapshot().items.map((board) => board.boardId),
        [91]
    );
    await store.loadPreview(91);
    assert.equal(store.getSnapshot().documents[91]?.title, "Saved journey 91");
    assert.equal(store.getSnapshot().documentErrors[91] || "", "");
    await store.loadMore();
    assert.deepEqual(
        store
            .getSnapshot()
            .items.map((board) => board.boardId)
            .sort(),
        [91, 92]
    );
    assert.equal(
        requests.some((url) => url.includes("scope=")),
        false
    );
    assert.equal(
        requests.some((url) => url.includes("page=2")),
        true
    );
    const Content = await content();
    const markup = renderToStaticMarkup(
        createElement(Content, { mode: "remix", state: store.getSnapshot(), actions: store })
    );
    assert.match(markup, />SAVED BOARDS<\/h1>/);
    assert.match(markup, /Their Board, your adventure/);
    assert.match(markup, /Use a saved Board as a starting point for your own trip\./);
    assert.match(markup, /href="\/boards\/91"/);
    assert.match(markup, /href="\/boards\/new\?remix=91"/);
    assert.doesNotMatch(markup, /\/boards\/91\/edit/);
    assert.doesNotMatch(
        markup,
        /Their inspiration|Great journeys|Saved inspiration needs a home|coming later|Continue a Board|type="search"|Filter Boards by publication status/i
    );
});

type ActionProps = {
    children?: ReactNode;
    href?: string;
    tabIndex?: number;
    onClick?: () => void;
    "aria-label"?: string;
    [key: string]: unknown;
};
function actionNodes(node: ReactNode): Array<{ type: unknown; props: ActionProps }> {
    if (Array.isArray(node)) return node.flatMap(actionNodes);
    if (!isValidElement<ActionProps>(node)) return [];
    return [{ type: node.type, props: node.props }, ...Children.toArray(node.props.children).flatMap(actionNodes)];
}

function assertSeparateLinks(markup: string) {
    const opened = { value: false };
    for (const token of markup.matchAll(/<\/?a(?:\s[^>]*|)>/g)) {
        if (token[0].startsWith("</")) opened.value = false;
        else {
            assert.equal(
                opened.value,
                false,
                "View and Remix must be sibling links rather than nested interactive elements"
            );
            opened.value = true;
        }
    }
    assert.equal(opened.value, false);
}

test("Only the primary saved card exposes View and Remix; another card selects without navigating or disclosing details", () => {
    for (const selected of [true, false]) {
        const actions = { selections: 0, disclosures: 0 };
        const props: ComponentProps<typeof PhotoBoardCardContent> = {
            board: toSelectionBoard(
                { ...saved(91), updatedAt: saved(91).savedAt, source: "saved", status: "published" },
                document()
            ).photo,
            details: true,
            expanded: false,
            detailsId: `saved-${selected}`,
            onExpandedChange: () => actions.disclosures++,
            selection: {
                selected,
                href: "/boards/91",
                remixHref: "/boards/new?remix=91",
                onSelect: () => actions.selections++
            }
        };
        const tree = PhotoBoardCardContent(props);
        const nodes = actionNodes(tree);
        const view = nodes.find((node) => node.props["aria-label"] === "View Saved journey 91");
        const remix = nodes.find((node) => node.props["aria-label"] === "Remix Saved journey 91");
        if (!selected) {
            assert.equal(view, undefined);
            assert.equal(remix, undefined);
            const select = nodes.find(
                (node) => node.type === "button" && node.props["data-board-selection"] !== undefined
            );
            assert.ok(select?.props.onClick);
            (select.props.onClick as (event: { defaultPrevented: boolean }) => void)({ defaultPrevented: false });
            assert.deepEqual(actions, { selections: 1, disclosures: 0 });
            const markup = renderToStaticMarkup(tree);
            assert.doesNotMatch(markup, /href=|lucide-eye|lucide-plus|lucide-pencil/);
            continue;
        }
        assert.ok(view);
        assert.ok(remix);
        assert.equal(view.props.href, "/boards/91");
        assert.equal(remix.props.href, "/boards/new?remix=91");
        for (const action of [view, remix]) {
            assert.equal(action.props.onClick, undefined, "Mouse, keyboard and touch retain native link navigation");
            assert.notEqual(action.props.tabIndex, -1, "Both saved-card actions remain keyboard reachable");
        }
        assert.deepEqual(actions, { selections: 0, disclosures: 0 });
        const markup = renderToStaticMarkup(tree);
        assertSeparateLinks(markup);
        assert.equal((markup.match(/href="\/boards\/91"/g) ?? []).length, 1);
        assert.equal((markup.match(/href="\/boards\/new\?remix=91"/g) ?? []).length, 1);
        assert.match(markup, /lucide-eye/);
        assert.match(markup, /lucide-plus/);
        assert.doesNotMatch(markup, /lucide-pencil|aria-label="Focus Saved journey 91"/);
        assert.match(markup, /group-focus(?:-visible|-within)[^\s"]*:opacity-100/);
        assert.match(markup, /\[@media\(hover:none\)\]:opacity-100/);
    }
});

test("Saved gallery and collection promote chosen cards; View and Remix follow only the selected primary Board", () => {
    const boards = [91, 92, 93].map((boardId) =>
        toSelectionBoard(
            {
                ...saved(boardId),
                updatedAt: saved(boardId).savedAt,
                source: "saved",
                status: "published"
            },
            { ...document(), boardId, title: `Saved journey ${boardId}` }
        )
    );
    const selections: number[] = [];
    const selection = { id: 91 };
    const captured: { nodes: ReturnType<typeof actionNodes> } = { nodes: [] };
    function Probe() {
        const tree = BoardSelectionGallery({
            boards,
            selected: boards.find((board) => board.summary.boardId === selection.id)!,
            mode: "remix",
            onSelect: (id) => {
                selections.push(id);
                selection.id = id;
            },
            onRetry() {}
        });
        captured.nodes = actionNodes(tree);
        return tree;
    }
    const gallery = renderToStaticMarkup(createElement(Probe));
    assertSeparateLinks(gallery);
    assert.match(gallery, /href="\/boards\/91"/);
    assert.match(gallery, /href="\/boards\/new\?remix=91"/);
    assert.doesNotMatch(gallery, /href="\/boards\/(?:92|93)"|href="\/boards\/new\?remix=(?:92|93)"/);
    for (const boardId of [92, 93]) assert.ok(gallery.includes(`aria-label="Focus Saved journey ${boardId}"`));
    assert.deepEqual(selections, []);
    const previous = captured.nodes.find((node) => node.props["aria-label"] === "Previous Board");
    const next = captured.nodes.find((node) => node.props["aria-label"] === "Next Board");
    assert.ok(previous?.props.onClick);
    assert.ok(next?.props.onClick);
    previous.props.onClick();
    next.props.onClick();
    assert.deepEqual(selections, [93, 92]);
    const promoted = renderToStaticMarkup(createElement(Probe));
    assert.match(promoted, /href="\/boards\/92"/);
    assert.match(promoted, /href="\/boards\/new\?remix=92"/);
    assert.doesNotMatch(promoted, /href="\/boards\/91"|href="\/boards\/new\?remix=91"/);
    const inactive = captured.nodes.find(
        (node) => (node.props.selection as { label?: string } | undefined)?.label === "Focus Saved journey 93"
    );
    assert.ok(inactive);
    assert.equal(inactive.props.details, false);
    (inactive.props.selection as { onSelect: () => void }).onSelect();
    assert.equal(selection.id, 93);
    const collectionTree: { tree: ReactNode } = { tree: null };
    function CollectionProbe() {
        collectionTree.tree = BoardSelectionCollection({
            boards,
            mode: "remix",
            onSelect: (id) => {
                selections.push(id);
                selection.id = id;
            }
        });
        return collectionTree.tree;
    }
    const collection = renderToStaticMarkup(createElement(CollectionProbe));
    assert.doesNotMatch(collection, /href=|lucide-eye|lucide-plus|lucide-pencil/);
    for (const boardId of [91, 92, 93])
        assert.ok(collection.includes(`aria-label="Focus Saved journey ${boardId} from collection"`));
    const card = actionNodes(collectionTree.tree).find(
        (node) =>
            (node.props.selection as { label?: string } | undefined)?.label === "Focus Saved journey 91 from collection"
    );
    assert.ok(card);
    assert.equal(card.props.details, false);
    (card.props.selection as { onSelect: () => void }).onSelect();
    assert.equal(selection.id, 91);
});

test("Selecting an overflow saved Board promotes it into the real page gallery and saved counts align with Continue", async (t) => {
    t.mock.method(globalThis, "fetch", async (input: string | URL | Request) => {
        const path = new URL(String(input)).pathname;
        if (path === "/api/v1/users/me/saved-boards")
            return Response.json({ data: [91, 92, 93, 94, 95, 96].map(saved), meta: { hasMore: false } });
        const id = Number(path.split("/").at(-1));
        return Response.json({ data: { ...document(), boardId: id, title: `Saved journey ${id}` } });
    });
    const store = createBoardSelectionStore(undefined, "remix");
    t.after(store.cancel);
    await store.load();
    await Promise.all([91, 92, 93, 94, 95, 96].map(store.loadPreview));
    const Content = await content();
    function presenter(mode: "continue" | "remix") {
        const states: unknown[] = [];
        return () => {
            const captured: { tree: ReactNode } = { tree: null };
            const cursor = { value: 0 };
            function Probe() {
                const original = React.useState;
                React.useState = ((initial: unknown) => {
                    const index = cursor.value++;
                    if (!(index in states)) states[index] = typeof initial === "function" ? initial() : initial;
                    return [
                        states[index],
                        (next: unknown) => {
                            states[index] = typeof next === "function" ? next(states[index]) : next;
                        }
                    ];
                }) as typeof React.useState;
                try {
                    captured.tree = Content({ mode, state: store.getSnapshot(), actions: store });
                    return null;
                } finally {
                    React.useState = original;
                }
            }
            renderToStaticMarkup(createElement(Probe));
            return {
                tree: captured.tree,
                nodes: actionNodes(captured.tree),
                markup: renderToStaticMarkup(captured.tree)
            };
        };
    }
    const renderSaved = presenter("remix");
    const initial = renderSaved();
    const collection = initial.nodes.find((node) => node.type === BoardSelectionCollection);
    assert.ok(collection);
    const overflowBoards = collection.props.boards as Array<{ summary: { boardId: number } }>;
    assert.equal(overflowBoards.length, 1);
    const chosenId = overflowBoards[0]!.summary.boardId;
    (collection.props.onSelect as (id: number) => void)(chosenId);
    const promoted = renderSaved();
    const gallery = promoted.nodes.find((node) => node.type === BoardSelectionGallery);
    assert.ok(gallery);
    assert.equal((gallery.props.selected as { summary: { boardId: number } }).summary.boardId, chosenId);
    assert.ok(promoted.markup.includes(`href="/boards/${chosenId}"`));
    assert.ok(promoted.markup.includes(`href="/boards/new?remix=${chosenId}"`));
    assert.doesNotMatch(promoted.markup, /href="\/boards\/91"|href="\/boards\/new\?remix=91"/);
    const continued = presenter("continue")();
    const savedHeader = initial.nodes.find((node) => node.type === "header");
    const continueHeader = continued.nodes.find((node) => node.type === "header");
    assert.ok(savedHeader);
    assert.ok(continueHeader);
    const savedHeaderNodes = actionNodes(savedHeader.props.children);
    const continueHeaderNodes = actionNodes(continueHeader.props.children);
    const savedStatus = savedHeaderNodes.find((node) => node.props.role === "status");
    const continueStatus = continueHeaderNodes.find((node) => node.props.role === "status");
    assert.ok(savedStatus);
    assert.ok(continueStatus);
    assert.equal(savedStatus.props.className, continueStatus.props.className);
    const spacer = savedHeaderNodes.find(
        (node) =>
            node.type === "div" &&
            node.props["aria-hidden"] === true &&
            Children.toArray(node.props.children).length === 0
    );
    const tabs = continueHeaderNodes.find((node) => node.props.role === "group");
    assert.ok(spacer, "Saved count reserves the Continue filter row's vertical space without exposing empty controls");
    assert.ok(tabs);
    assert.equal(spacer.props.className, tabs.props.className);
    assert.match(String(spacer.props.className), /min-h-11/);
    assert.doesNotMatch(
        renderToStaticMarkup(savedHeader.props.children),
        /Filter Boards by publication status|>Drafts<|>Published</
    );
});

test("An unavailable saved list exposes retry and cannot silently fall back to the user's owned Boards", async (t) => {
    const attempts = { value: 0 };
    t.mock.method(globalThis, "fetch", async (input: string | URL | Request) => {
        assert.equal(new URL(String(input)).pathname, "/api/v1/users/me/saved-boards");
        attempts.value += 1;
        return attempts.value === 1
            ? Response.json({ error: { message: "Saved Boards unavailable" } }, { status: 503 })
            : Response.json({ data: [], meta: { hasMore: false } });
    });
    const store = createBoardSelectionStore(undefined, "remix");
    t.after(store.cancel);
    await store.load();
    const Content = await content();
    const failed = renderToStaticMarkup(
        createElement(Content, { mode: "remix", state: store.getSnapshot(), actions: store })
    );
    assert.match(failed, /Saved Boards unavailable/);
    assert.match(failed, /Retry/i);
    await store.load();
    assert.deepEqual(store.getSnapshot().items, []);
    const empty = renderToStaticMarkup(
        createElement(Content, { mode: "remix", state: store.getSnapshot(), actions: store })
    );
    assert.doesNotMatch(empty, /Saved Boards unavailable/);
    assert.match(empty, /saved/i);
});

test("Opening a saved copy calls preparation rather than persisting a new Board, and propagates failures for retry", async (t) => {
    const requests: Array<{ path: string; method?: string }> = [];
    const prepared = {
        title: "Paris",
        description: "Notes",
        destination: null,
        tags: [],
        images: [],
        coverImageId: null,
        days: []
    };
    t.mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
        const url = new URL(String(input));
        requests.push({ path: url.pathname, method: init?.method });
        assert.equal(init?.credentials, "include");
        return requests.length === 1
            ? Response.json(
                  { error: { code: "IMAGE_COPY_UNAVAILABLE", message: "Photos could not be copied" } },
                  { status: 503 }
              )
            : Response.json({ data: prepared });
    });
    await assert.rejects(prepareBoardRemix(91), /Photos could not be copied/);
    assert.deepEqual(await prepareBoardRemix(91), prepared);
    assert.deepEqual(requests, [
        { path: "/api/v1/boards/91/remix-content", method: "POST" },
        { path: "/api/v1/boards/91/remix-content", method: "POST" }
    ]);
});

test("Prepared activities and their photos survive creator editing and first Save creates a new Board", async (t) => {
    const prepared: PreparedBoardCopy = {
        title: "Paris on foot",
        description: "Keep these notes",
        destination: null,
        tags: [{ tagId: 1, name: "Food" }],
        coverImageId: 130,
        images: [120, 130, 140].map((imageId, position) => ({
            imageId,
            position,
            url: `/api/v1/images/${imageId}/content?variant=display`,
            thumbnailUrl: `/api/v1/images/${imageId}/content?variant=thumbnail`,
            capturedAt: null
        })),
        days: [1, 2].map((dayNumber) => ({
            dayNumber,
            date: null,
            activities: [0, 1].map((position) => ({
                position,
                title: `Day ${dayNumber} stop ${position}`,
                activityTime: position ? "15:30" : "09:00",
                category: "museum",
                note: "Visit",
                source: "manual",
                location: null,
                locationConfirmed: false,
                uploadedImageIds: dayNumber === 1 ? (position === 0 ? [130, 120] : [140]) : [],
                coverImageId: dayNumber === 1 ? (position === 0 ? 120 : 140) : null,
                externalImage:
                    dayNumber === 2
                        ? {
                              provider: "unsplash",
                              providerImageId: `photo-${position}`,
                              url: `https://images.unsplash.com/photo-${position}`,
                              photographer: `Author ${position}`,
                              photographerUrl: `https://unsplash.com/@author${position}`,
                              sourceUrl: `https://unsplash.com/photos/photo-${position}`
                          }
                        : null
            }))
        }))
    };
    const requests: Array<{ path: string; method?: string; body?: Record<string, unknown> }> = [];
    t.mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
        const path = new URL(String(input)).pathname;
        const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : undefined;
        requests.push({ path, method: init?.method, body });
        if (path.endsWith("/remix-content")) return Response.json({ data: prepared });
        const savedBoard: BoardDocument = {
            ...document(),
            ...body,
            boardId: 300,
            title: "My Paris copy",
            revision: requests.length === 2 ? 1 : 2,
            permissions: { canEditContent: true, canManageBoard: true },
            author: { username: "new-owner", bio: "", photo: null }
        };
        return Response.json({ data: savedBoard });
    });
    const copy = await prepareBoardRemix(91);
    const restored = fromBoardDocument(copy);
    assert.equal(requests.length, 1);
    assert.equal(restored.days.length, 2);
    assert.notEqual(restored.days[0]!.pins[0]!.id, restored.days[0]!.pins[1]!.id);
    const draft = toBoardWrite(
        {
            ...restored,
            title: "My Paris copy",
            description: copy.description ?? "",
            status: "draft",
            visibility: "collaborators",
            coverImageId: copy.coverImageId,
            tags: ["Food"]
        },
        [{ tagId: 1, name: "Food" }]
    );
    assert.deepEqual(
        draft.days.map((day) => day.activities.map((activity) => activity.uploadedImageIds)),
        [
            [[130, 120], [140]],
            [[], []]
        ]
    );
    assert.deepEqual(
        draft.days[1]!.activities.map((activity) => activity.externalImage),
        prepared.days[1]!.activities.map((activity) => activity.externalImage)
    );
    assert.equal(draft.days[0]!.activities[0]!.coverImageId, 120);
    assert.equal(draft.coverImageId, 130);
    assert.deepEqual(
        draft.days.map((day) => day.activities.map((activity) => activity.activityTime)),
        [
            ["09:00", "15:30"],
            ["09:00", "15:30"]
        ]
    );
    assert.ok(
        draft.days.every(
            (day) =>
                day.dayId === undefined &&
                day.date === null &&
                day.activities.every((activity) => activity.activityId === undefined)
        )
    );
    const created = await saveBoardDocument(draft);
    assert.equal(created.boardId, 300);
    await saveBoardDocument({ ...draft, title: "My edited copy" }, created);
    assert.deepEqual(
        requests.map(({ path, method }) => ({ path, method })),
        [
            { path: "/api/v1/boards/91/remix-content", method: "POST" },
            { path: "/api/v1/boards", method: "POST" },
            { path: "/api/v1/boards/300", method: "PUT" }
        ]
    );
    assert.equal(requests[1]!.body?.title, "My Paris copy");
    assert.equal(requests[1]!.body?.visibility, "collaborators");
    assert.equal(requests[2]!.body?.revision, 1);
});
