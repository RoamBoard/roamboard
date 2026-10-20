import assert from "node:assert/strict";
import test from "node:test";
import { Children, createElement, isValidElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { SearchParamsContext, PathnameContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime";
import { BoardCollectionGridContent } from "../src/components/features/boards/BoardCollectionGrid";
import AccountPhotoBoardCard from "../src/components/features/boards/cards/AccountPhotoBoardCard";
import { createDiscoveryStore, type DiscoveryCard } from "../src/lib/boards-discovery";
import type { CollectionContext } from "../src/lib/board-collections";
import Pagination from "../src/components/ui/Pagination";

type Props = { children?: ReactNode; [key: string]: unknown };
function elements(node: ReactNode): Array<{ type: unknown; props: Props }> {
    if (!isValidElement<Props>(node)) return [];
    return [{ type: node.type, props: node.props }, ...Children.toArray(node.props.children).flatMap(elements)];
}
const card = (boardId: number, owned = false): DiscoveryCard => ({
    boardId,
    title: `Bali ${boardId}`,
    description: "Holiday",
    status: "published",
    visibility: "public",
    owner: { username: owned ? "viewer" : "friend", displayName: "Traveler", photoUrl: null },
    destination: null,
    coverImageUrl: null,
    tags: [],
    durationDays: 1,
    activityCount: 2,
    savedCount: 3,
    savedByMe: !owned,
    firstPublishedAt: "2026-10-20T00:00:00Z",
    updatedAt: "2026-10-20T00:00:00Z",
    permissions: { canEditContent: owned, canManageBoard: owned }
});
function render(context: CollectionContext, search: string, store = createDiscoveryStore()) {
    const navigations: string[] = [];
    const holder: { nodes: ReturnType<typeof elements> } = { nodes: [] };
    const router = {
        back() {},
        forward() {},
        refresh() {},
        replace() {},
        prefetch() {},
        push: (href: string) => navigations.push(href)
    };
    function Probe() {
        const tree = BoardCollectionGridContent({
            context,
            account: { ready: true, user: { userId: "viewer", username: "viewer", displayName: "Viewer" } },
            store
        });
        holder.nodes = elements(tree);
        return tree;
    }
    const markup = renderToStaticMarkup(
        createElement(
            AppRouterContext.Provider,
            { value: router as unknown as Parameters<typeof AppRouterContext.Provider>[0]["value"] },
            createElement(
                SearchParamsContext.Provider,
                { value: new URLSearchParams(search) },
                createElement(
                    PathnameContext.Provider,
                    { value: `/boards/collections/${context}` },
                    createElement(Probe)
                )
            )
        )
    );
    return { markup, nodes: holder.nodes, navigations };
}

test("changing sorting and page preserves the map context and submitted query", () => {
    const { nodes, navigations } = render("map", "handle=friend&country=IDN&collection=both&q=Bali&page=3");
    const sort = nodes.find((node) => node.type === "select")!;
    (sort.props.onChange as (event: unknown) => void)({ target: { value: "title-asc" } });
    const next = new URL(navigations[0], "http://localhost");
    assert.equal(next.searchParams.get("handle"), "friend");
    assert.equal(next.searchParams.get("country"), "IDN");
    assert.equal(next.searchParams.get("collection"), "both");
    assert.equal(next.searchParams.get("q"), "Bali");
    assert.equal(next.searchParams.get("sort"), "title-asc");
    assert.equal(next.searchParams.has("page"), false);
    const pagination = nodes.find((node) => node.type === Pagination)!;
    const page = new URL((pagination.props.href as (page: number) => string)(4), "http://localhost");
    assert.equal(page.searchParams.get("page"), "4");
    assert.equal(page.searchParams.get("country"), "IDN");
});

test("search submission stays in the saved profile collection, selects relevance and resets page", (t) => {
    const { nodes, navigations } = render("profile-saved", "handle=traveler&page=3&sort=title-desc");
    const form = nodes.find((node) => node.type === "form")!;
    const data = new FormData();
    data.set("q", "  Bali  ");
    t.mock.method(globalThis, "FormData", function () {
        return data;
    } as unknown as typeof FormData);
    (form.props.onSubmit as (event: unknown) => void)({ preventDefault() {}, currentTarget: {} });
    const next = new URL(navigations[0], "http://localhost");
    assert.equal(next.pathname, "/boards/collections/profile-saved");
    assert.equal(next.searchParams.get("handle"), "traveler");
    assert.equal(next.searchParams.get("q"), "Bali");
    assert.equal(next.searchParams.get("sort"), "relevance");
    assert.equal(next.searchParams.has("page"), false);
});

test("the grid uses summary permissions for owner edit and other-author bookmarks without document reads", async (t) => {
    const calls: string[] = [];
    const items = [card(1, true), card(2)];
    const store = createDiscoveryStore();
    t.mock.method(globalThis, "fetch", async (input: string, init?: RequestInit) => {
        calls.push(input);
        assert.equal(init?.credentials, "include");
        return Response.json({ data: { items, page: 1, limit: 20, total: 21, hasMore: true } });
    });
    await store.load("/boards/collections/recent?page=1&limit=20&sort=published-desc");
    const { nodes, markup } = render("recent", "", store);
    const cards = nodes.filter((node) => node.type === AccountPhotoBoardCard);
    assert.equal(cards.length, 2);
    assert.equal(cards[0].props.ownership, "owner");
    assert.deepEqual(cards[0].props.hoverActions, { editHref: "/boards/1/edit", viewHref: "/boards/1" });
    assert.equal(cards[1].props.ownership, "other");
    assert.equal(cards[1].props.initialSaved, true);
    assert.match(markup, /href="\/boards\/1\/edit"/);
    assert.match(markup, /aria-label="Page 2"/);
    assert.equal(calls.length, 1);
    const changed = render("recent", "q=Indonesia", store);
    assert.equal(
        changed.nodes.filter((node) => node.type === AccountPhotoBoardCard).length,
        0,
        "previous query results must not appear beneath a new query"
    );
});

test("empty collections and no search matches remain distinct and failures retain retry", async (t) => {
    const store = createDiscoveryStore();
    t.mock.method(globalThis, "fetch", async () =>
        Response.json({ data: { items: [], total: 0, page: 1, limit: 20 } })
    );
    await store.load("/boards/collections/saved?page=1&limit=20&sort=saved-at-desc");
    assert.match(render("saved", "", store).markup, /No Boards in this collection yet/);
    await store.load("/boards/collections/saved?page=1&limit=20&q=Bali&sort=relevance");
    assert.match(render("saved", "q=Bali", store).markup, /No Boards match this search in this collection/);
    t.mock.method(globalThis, "fetch", async () =>
        Response.json({ error: { message: "Try again later" } }, { status: 503 })
    );
    await store.load("/boards/collections/saved?page=1&limit=20&sort=saved-at-desc");
    assert.match(render("saved", "", store).markup, /Try again later/);
    assert.doesNotMatch(render("saved", "", store).markup, /No Boards in this collection yet/);
});
