import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { Children, createElement, isValidElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { BoardSelectionGallery } from "../src/components/features/boards/BoardSelectionGallery";
import BoardLibrary from "../src/components/features/boards/BoardLibrary";
import {
    createDiscoveryStore,
    discoveryGallery,
    discoverySelection,
    type DiscoveryCard
} from "../src/lib/boards-discovery";

const router = {
    bfcacheId: "boards-test",
    back() {},
    forward() {},
    refresh() {},
    push() {},
    replace() {},
    prefetch() {}
};
async function renderPage(query = "", signedIn = true) {
    const modules = createRequire(import.meta.url);
    const previous = modules.extensions[".css"];
    modules.extensions[".css"] = (module) => {
        module.exports = {};
    };
    const BoardsDiscoveryContent = await (async () => {
        try {
            return (await import("../src/components/features/boards/BoardsDiscovery")).BoardsDiscoveryContent;
        } finally {
            if (previous) modules.extensions[".css"] = previous;
            else delete modules.extensions[".css"];
        }
    })();
    return renderToStaticMarkup(
        createElement(
            AppRouterContext.Provider,
            { value: router },
            createElement(BoardsDiscoveryContent, {
                query,
                page: 1,
                location: "auto",
                account: {
                    ready: true,
                    user: signedIn ? { userId: "viewer", username: "viewer", displayName: "Viewer" } : null
                }
            })
        )
    );
}

test("production Boards discovery orders sections, defaults to month and contains no Archive", async () => {
    const html = await renderPage();
    assert.match(html, /<h1[^>]*>BOARDS<\/h1>/);
    const labels = ["Featured period", "boards-discover-heading", "recent-heading", "mine-heading", "saved-heading"];
    const positions = labels.map((label) => html.indexOf(label));
    assert.ok(positions.every((position) => position >= 0));
    assert.deepEqual(
        positions,
        [...positions].sort((a, b) => a - b)
    );
    assert.match(html, /aria-pressed="true"[^>]*>This month/);
    assert.match(html, /role="search"/);
    assert.match(html, /role="combobox"/);
    assert.doesNotMatch(html, /archiv/i);
    assert.doesNotMatch(html, /THE COLLECTION/);
});

test("personal BoardLibrary carousel preserves draft editor and published viewing routes with persistent status labels", () => {
    const draft = { ...card(true), boardId: 89, title: "Draft journey", status: "draft" as const };
    const html = renderToStaticMarkup(
        createElement(BoardLibrary, {
            title: "MY BOARDS",
            id: "mine",
            boards: [discoveryGallery(card(true)), discoveryGallery(draft)],
            showStatus: true
        })
    );
    assert.match(html, /aria-roledescription="carousel"/);
    assert.match(html, /href="\/boards\/88"/);
    assert.match(html, /href="\/boards\/88\/edit"/);
    assert.match(html, /href="\/boards\/drafts\/89"/);
    assert.doesNotMatch(html, /href="\/boards\/89"/);
    assert.match(html, />Draft<\//);
    assert.match(html, />Published<\//);
    assert.doesNotMatch(html, /THE COLLECTION/);
});

test("loaded personal sections use BoardLibrary and preserve confirmed removal wiring without a collection grid", async (context) => {
    await renderPage();
    const { DiscoveryCollectionContent } = await import("../src/components/features/boards/BoardsDiscovery");
    const store = createDiscoveryStore();
    const requests: string[] = [];
    context.mock.method(globalThis, "fetch", async (url: string) => {
        requests.push(url);
        return Response.json({ data: { items: [card()], page: 1, hasMore: true } });
    });
    await store.load("/boards/saved?page=1&limit=10");
    const capture = (source: "owned" | "saved") => {
        const captured: { tree: ReactNode } = { tree: null };
        function Probe() {
            captured.tree = DiscoveryCollectionContent({
                title: source === "owned" ? "MY BOARDS" : "SAVED BOARDS",
                id: source === "owned" ? "mine" : "saved",
                path: `/boards/${source === "owned" ? "mine" : "saved"}`,
                limit: 10,
                source,
                state: store.getSnapshot(),
                store
            });
            return null;
        }
        renderToStaticMarkup(createElement(Probe));
        return captured.tree;
    };
    const library = (node: ReactNode): ReactNode =>
        Children.toArray(node)
            .flatMap((child): ReactNode[] => {
                if (!isValidElement<{ children?: ReactNode }>(child)) return [];
                return child.type === BoardLibrary ? [child] : [library(child.props.children)];
            })
            .find(Boolean);
    for (const source of ["owned", "saved"] as const) {
        const tree = capture(source);
        const html = renderToStaticMarkup(tree);
        assert.match(html, /aria-roledescription="carousel"/);
        assert.doesNotMatch(html, /THE COLLECTION/);
        const element = library(tree);
        assert.ok(
            isValidElement<{ showStatus: boolean; onSavedChange?: (id: string, saved: boolean) => void }>(element)
        );
        assert.equal(element.props.showStatus, true);
        if (source === "saved") {
            assert.equal(typeof element.props.onSavedChange, "function");
            element.props.onSavedChange!("88", true);
            assert.equal(store.getSnapshot().data?.items.length, 1);
            // Keep one unaffected item, so the Node test never needs to emulate browser focus.
            const refresh = { first: true };
            context.mock.method(globalThis, "fetch", async (url: string) => {
                requests.push(url);
                const items = refresh.first ? [card(), { ...card(), boardId: 90 }] : [{ ...card(), boardId: 90 }];
                refresh.first = false;
                return Response.json({ data: { items, page: 1, hasMore: false } });
            });
            await store.load("/boards/saved?page=1&limit=10");
            element.props.onSavedChange!("88", false);
            assert.deepEqual(
                store.getSnapshot().data?.items.map((item) => item.boardId),
                [90]
            );
            await new Promise<void>((resolve) => setImmediate(resolve));
            assert.match(requests.at(-1)!, /\/boards\/saved\?page=1&limit=10$/);
            assert.deepEqual(
                store.getSnapshot().data?.items.map((item) => item.boardId),
                [90]
            );
        }
    }
});

test("submitted search retains the input but replaces discovery and personal sections", async () => {
    const html = await renderPage("Stockholm cafés");
    assert.match(html, /value="Stockholm cafés"/);
    assert.match(html, /search-results-heading/);
    assert.match(html, /Clear search and explore Boards/);
    for (const label of [
        "Featured period",
        "boards-discover-heading",
        "recent-heading",
        "mine-heading",
        "saved-heading"
    ])
        assert.equal(html.includes(label), false);
});

test("visitors see public discovery and one sign-in prompt in place of personal collections", async () => {
    const html = await renderPage("", false);
    assert.match(html, /recent-heading/);
    assert.doesNotMatch(html, /id="mine-heading"|id="saved-heading"/);
    assert.equal((html.match(/href="\/login\?returnTo=%2Fboards"/g) ?? []).length, 1);
});

function card(owned = false): DiscoveryCard {
    return {
        boardId: 88,
        title: "Stockholm escape",
        description: "Cafés and parks",
        status: "published",
        visibility: "public",
        owner: { username: "author", displayName: "Author", photoUrl: null },
        destination: { name: "Stockholm", city: "Stockholm", country: "SWE", address: null },
        coverImageUrl: null,
        tags: [],
        durationDays: 2,
        activityCount: 4,
        savedCount: 3,
        savedByMe: false,
        firstPublishedAt: "2026-10-01T00:00:00Z",
        updatedAt: "2026-10-02T00:00:00Z",
        permissions: { canEditContent: owned, canManageBoard: owned }
    };
}

test("recent gallery opens published boards without offering Remix; owned published cards retain Edit and View", () => {
    const shared = discoverySelection(card());
    const sharedHtml = renderToStaticMarkup(
        createElement(BoardSelectionGallery, {
            boards: [shared],
            selected: shared,
            mode: "explore",
            onSelect() {},
            onRetry() {}
        })
    );
    assert.match(sharedHtml, /href="\/boards\/88"/);
    assert.doesNotMatch(sharedHtml, /\/boards\/new\?remix=|aria-label="Remix/);
    const owned = discoverySelection(card(true), "owned");
    const ownedHtml = renderToStaticMarkup(
        createElement(BoardSelectionGallery, {
            boards: [owned],
            selected: owned,
            mode: "continue",
            onSelect() {},
            onRetry() {}
        })
    );
    assert.match(ownedHtml, /href="\/boards\/88\/edit"/);
    assert.match(ownedHtml, /href="\/boards\/88"/);
    assert.match(ownedHtml, /Published/);
});
