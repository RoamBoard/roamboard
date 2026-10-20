import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import React, { Children, isValidElement, type ComponentProps, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { setImmediate } from "node:timers/promises";
import DestinationStoryCard from "../src/components/features/destinations/DestinationStoryCard";
import AccountPhotoBoardCard from "../src/components/features/boards/cards/AccountPhotoBoardCard";
import type { BoardDocument } from "../src/lib/board-creator-api";

function harness(t: TestContext) {
    const state: unknown[] = [];
    const current: { index: number; effect?: React.EffectCallback } = { index: 0 };
    t.mock.method(React, "useState", ((initial: unknown) => {
        const index = current.index++;
        if (!(index in state)) state[index] = initial;
        return [
            state[index],
            (value: unknown) => {
                state[index] = value;
            }
        ];
    }) as typeof React.useState);
    t.mock.method(React, "useEffect", (effect: React.EffectCallback) => {
        current.effect = effect;
    });
    return {
        render(selected = true, presentation: Partial<ComponentProps<typeof DestinationStoryCard>> = {}) {
            current.index = 0;
            return DestinationStoryCard({
                board: {
                    id: "91",
                    title: "Summary title",
                    author: "summary_author",
                    destination: "Kyoto",
                    destinationLabel: "JPN"
                },
                details: selected,
                selection: { selected, onSelect() {} },
                ...presentation
            });
        },
        load: () => current.effect?.()
    };
}

function accountProps(node: ReactNode): ComponentProps<typeof AccountPhotoBoardCard> {
    assert.ok(isValidElement<{ children?: ReactNode }>(node));
    const card = Children.toArray(node.props.children).find(
        (child) => isValidElement(child) && child.type === AccountPhotoBoardCard
    );
    assert.ok(isValidElement<ComponentProps<typeof AccountPhotoBoardCard>>(card));
    return card.props;
}

const document: BoardDocument = {
    boardId: 91,
    revision: 1,
    status: "published",
    title: "Real title",
    description: "Real notes",
    visibility: "public",
    author: { username: "actual_author", bio: "", photo: { imageId: 7, url: "/api/v1/images/7/content?boardId=91" } },
    savedByMe: true,
    savedCount: 12,
    permissions: { canManageBoard: false, canEditContent: false },
    tagIds: [],
    tags: [],
    imageIds: [],
    images: [],
    coverImageId: null,
    days: [],
    createdAt: "2026-10-20T00:00:00Z",
    updatedAt: "2026-10-20T00:00:00Z"
};

test("only the selected destination card loads canonical account metadata through the credentialed Board API", async (t) => {
    const requests: string[] = [];
    t.mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
        requests.push(new URL(String(input)).pathname);
        assert.equal(init?.credentials, "include");
        return Response.json({ data: document });
    });
    const card = harness(t);
    card.render(false);
    card.load();
    assert.deepEqual(requests, []);
    card.render();
    card.load();
    await setImmediate();
    const props = accountProps(card.render());
    assert.deepEqual(requests, ["/api/v1/boards/91"]);
    assert.equal(props.board.author, "actual_author");
    assert.match(props.board.authorPhotoUrl!, /boardId=91/);
    assert.equal(props.board.savedCount, 12);
    assert.equal(props.ownership, "other");
    assert.equal(props.initialSaved, true);
    assert.deepEqual(props.hoverActions, { editHref: undefined, viewHref: "/boards/91" });
    card.load();
    assert.equal(requests.length, 1, "A loaded card reuses its document");
});

test("a canceled destination preview cannot add ownership permissions or replace its summary", async (t) => {
    const pending: { resolve?: (response: Response) => void } = {};
    t.mock.method(
        globalThis,
        "fetch",
        () =>
            new Promise<Response>((resolve) => {
                pending.resolve = resolve;
            })
    );
    const card = harness(t);
    card.render();
    const cleanup = card.load();
    assert.equal(typeof cleanup, "function");
    if (typeof cleanup === "function") cleanup();
    pending.resolve?.(
        Response.json({ data: { ...document, permissions: { canManageBoard: true, canEditContent: true } } })
    );
    await setImmediate();
    const props = accountProps(card.render());
    assert.equal(props.board.title, "Summary title");
    assert.equal(props.ownership, "unknown");
    assert.equal(props.hoverActions?.editHref, undefined);
});

test("failed destination metadata stays usable and retries into the permitted owner pen", async (t) => {
    const calls = { count: 0 };
    t.mock.method(globalThis, "fetch", async () => {
        calls.count++;
        return calls.count === 1
            ? Response.json({ error: { code: "INTERNAL_ERROR", message: "Unavailable" } }, { status: 503 })
            : Response.json({ data: { ...document, permissions: { canManageBoard: true, canEditContent: true } } });
    });
    const card = harness(t);
    card.render();
    card.load();
    await setImmediate();
    const failed = card.render();
    assert.equal(accountProps(failed).board.title, "Summary title");
    const retry = Children.toArray(failed.props.children).find(
        (child) => isValidElement(child) && child.type === "button"
    );
    assert.ok(isValidElement<{ onClick: () => void }>(retry));
    retry.props.onClick();
    card.render();
    card.load();
    await setImmediate();
    const loaded = accountProps(card.render());
    assert.equal(loaded.ownership, "owner");
    assert.deepEqual(loaded.hoverActions, { editHref: "/boards/91/edit", viewHref: "/boards/91" });
});

test("destination typography and watermark placement survive canonical enrichment without changing permissions or adding requests", async (t) => {
    const requests: string[] = [];
    t.mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
        requests.push(new URL(String(input)).pathname);
        assert.equal(init?.credentials, "include");
        return Response.json({ data: { ...document, permissions: { canManageBoard: true, canEditContent: true } } });
    });
    const appearance = {
        board: {
            id: "91",
            title: "Summary title",
            author: "summary_author",
            destination: "Kyoto",
            destinationLabel: "JPN",
            labelOffset: 33
        }
    };
    const card = harness(t);
    assert.equal(accountProps(card.render(true, { ...appearance, galleryCover: true })).board.labelOffset, 33);
    card.load();
    await setImmediate();
    const inactive = accountProps(card.render(false, { ...appearance, galleryCover: true }));
    assert.equal(inactive.galleryCover, true);
    assert.equal(inactive.board.title, "Real title");
    assert.equal(inactive.board.labelOffset, 33);
    assert.equal(inactive.ownership, "owner");
    assert.equal(inactive.initialSaved, true);
    assert.equal(inactive.hoverActions, undefined);
    const selected = accountProps(card.render(true, { ...appearance, galleryCover: true }));
    assert.equal(selected.galleryCover, true);
    assert.equal(selected.board.labelOffset, 33);
    assert.deepEqual(selected.hoverActions, { editHref: "/boards/91/edit", viewHref: "/boards/91" });
    card.load();
    assert.deepEqual(requests, ["/api/v1/boards/91"]);
});

test("a direct collection card resolves owner permissions before offering Edit instead of a bookmark", async (t) => {
    t.mock.method(globalThis, "fetch", async () =>
        Response.json({ data: { ...document, permissions: { canManageBoard: true, canEditContent: true } } })
    );
    const card = harness(t);
    const direct = { selection: undefined, href: "/boards/91" };
    assert.equal(accountProps(card.render(true, direct)).ownership, "unknown");
    card.load();
    await setImmediate();
    const props = accountProps(card.render(true, direct));
    assert.equal(props.href, "/boards/91");
    assert.equal(props.ownership, "owner");
    assert.deepEqual(props.hoverActions, { editHref: "/boards/91/edit", viewHref: "/boards/91" });
    t.mock.restoreAll();
    const html = renderToStaticMarkup(React.createElement(AccountPhotoBoardCard, props));
    assert.match(html, /aria-label="Edit Real title"/);
    assert.doesNotMatch(html, /aria-label="(?:Save |Unsave )/);
});
