import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test, { type TestContext } from "node:test";
import React, { Children, createElement, isValidElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createBoardSelectionStore, type BoardSelectionStore } from "../src/lib/board-selection-store";

// Node does not interpret CSS modules. Only styling is replaced; the page, gallery,
// store and credentialed request helpers below are the production implementations.
async function loadContent() {
    const modules = createRequire(import.meta.url);
    const original = modules.extensions[".css"];
    modules.extensions[".css"] = (module) => {
        module.exports = {};
    };
    try {
        return (await import("../src/components/features/boards/BoardSelectionExperience")).BoardSelectionContent;
    } finally {
        if (original) modules.extensions[".css"] = original;
        else delete modules.extensions[".css"];
    }
}

type Props = {
    children?: ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    "aria-pressed"?: boolean;
};

function text(node: ReactNode): string {
    return Children.toArray(node)
        .map((child) => (isValidElement<Props>(child) ? text(child.props.children) : String(child)))
        .join("");
}

function buttons(node: ReactNode): Props[] {
    return Children.toArray(node).flatMap((child): Props[] => {
        if (!isValidElement<Props>(child)) return [];
        return [...(child.type === "button" ? [child.props] : []), ...buttons(child.props.children)];
    });
}

// Match the existing Node/React interaction-test approach: retain the page's hook
// state, invoke its actual handlers, then render its real children with normal hooks.
// This tests page wiring, not browser layout, focus or event propagation.
function mount(Content: Awaited<ReturnType<typeof loadContent>>, store: BoardSelectionStore) {
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
                captured.tree = Content({ mode: "continue", state: store.getSnapshot(), actions: store });
                return null;
            } finally {
                React.useState = original;
            }
        }
        renderToStaticMarkup(createElement(Probe));
        const controls = buttons(captured.tree);
        return {
            markup: renderToStaticMarkup(captured.tree),
            labels: controls.map((button) => text(button.children)),
            button(label: string) {
                const button = controls.find((candidate) => text(candidate.children).startsWith(label));
                assert.ok(button, `Expected the page to expose ${label}`);
                return button;
            }
        };
    };
}

function summary(boardId: number, title: string) {
    return { boardId, title, coverImageUrl: null, updatedAt: "2026-10-19T10:00:00Z" };
}

function page(items: ReturnType<typeof summary>[], hasMore = false) {
    return Response.json({ data: items, meta: { hasMore } });
}

function failure() {
    return Response.json({ error: { message: "Scope temporarily unavailable" } }, { status: 503 });
}

function pendingResponse() {
    const pending: { resolve?: (response: Response) => void } = {};
    return {
        promise: new Promise<Response>((resolve) => {
            pending.resolve = resolve;
        }),
        resolve(response: Response) {
            assert.ok(pending.resolve);
            pending.resolve(response);
        }
    };
}

const flush = () => new Promise<void>((resolve) => setImmediate(resolve));

async function fixture(t: TestContext, respond: (scope: string, page: number) => Response | Promise<Response>) {
    const requests: string[] = [];
    t.mock.method(globalThis, "fetch", (input: string | URL | Request, init?: RequestInit) => {
        const url = new URL(String(input));
        assert.equal(url.pathname, "/api/v1/boards");
        assert.equal(init?.credentials, "include");
        assert.equal(init?.cache, "no-store");
        const scope = url.searchParams.get("scope")!;
        const number = Number(url.searchParams.get("page"));
        requests.push(`${scope}:${number}`);
        return Promise.resolve(respond(scope, number));
    });
    const store = createBoardSelectionStore();
    t.after(store.cancel);
    await store.load();
    return { render: mount(await loadContent(), store), requests };
}

test("Continue starts on Published at the left and switching to Drafts changes the visible collection and pagination", async (t) => {
    const { render } = await fixture(t, (scope) =>
        scope === "drafts" ? page([summary(21, "Unfinished Lisbon")], true) : page([summary(11, "Published Kyoto")])
    );
    const published = render();
    assert.deepEqual(published.labels.slice(0, 2), ["Published", "Drafts"]);
    assert.equal(published.button("Published")["aria-pressed"], true);
    assert.equal(published.button("Drafts")["aria-pressed"], false);
    assert.match(published.markup, /Published Kyoto/);
    assert.doesNotMatch(published.markup, /Unfinished Lisbon|Load more Boards/);
    assert.match(published.markup, /1 published Board/);

    published.button("Drafts").onClick!();
    const drafts = render();
    assert.equal(drafts.button("Published")["aria-pressed"], false);
    assert.equal(drafts.button("Drafts")["aria-pressed"], true);
    assert.match(drafts.markup, /Unfinished Lisbon/);
    assert.doesNotMatch(drafts.markup, /Published Kyoto/);
    assert.match(drafts.markup, /1 draft loaded/);
    assert.ok(drafts.button("Load more Boards"));

    drafts.button("Published").onClick!();
    assert.doesNotMatch(render().markup, /Unfinished Lisbon|Load more Boards/);
});

test("Published pagination remains available when Drafts is complete, disables while pending, and appends only published results", async (t) => {
    const next = pendingResponse();
    const { render, requests } = await fixture(t, (scope, number) =>
        scope === "drafts"
            ? page([summary(31, "Draft Oslo")])
            : number === 1
              ? page([summary(41, "Published Rome")], true)
              : next.promise
    );
    render().button("Load more Boards").onClick!();
    assert.equal(render().button("Loading more Boards").disabled, true);
    assert.deepEqual(requests, ["drafts:1", "published:1", "published:2"]);
    next.resolve(page([summary(42, "Published Porto")]));
    await flush();
    const loaded = render();
    assert.match(loaded.markup, /Published Rome/);
    assert.match(loaded.markup, /Published Porto/);
    assert.match(loaded.markup, /2 published Boards/);
    assert.doesNotMatch(loaded.markup, /Draft Oslo|Load more Boards/);
    loaded.button("Drafts").onClick!();
    assert.match(render().markup, /Draft Oslo/);
    assert.doesNotMatch(render().markup, /Published Rome|Published Porto|Load more Boards/);
});

test("an initial Published failure can be retried through the page without discarding completed Drafts", async (t) => {
    const attempts = { published: 0 };
    const { render, requests } = await fixture(t, (scope) => {
        if (scope === "drafts") return page([summary(51, "Draft Seville")]);
        attempts.published += 1;
        return attempts.published === 1 ? failure() : page([summary(61, "Published Seoul")]);
    });
    assert.match(render().markup, /Published Boards could not be loaded/);
    assert.doesNotMatch(render().markup, /Draft Seville/);
    render().button("Retry unavailable pages").onClick!();
    assert.equal(render().button("Retry unavailable pages").disabled, true);
    await flush();
    assert.deepEqual(requests, ["drafts:1", "published:1", "published:1"]);
    assert.match(render().markup, /Published Seoul/);
    assert.doesNotMatch(render().markup, /could not be loaded|Retry unavailable pages|Load more Boards/);
    render().button("Drafts").onClick!();
    assert.match(render().markup, /Draft Seville/);
    assert.doesNotMatch(render().markup, /Published Seoul/);
});

test("mixed page results preserve both filters and retry only the failed Drafts page at its original cursor", async (t) => {
    const attempts = { drafts: 0 };
    const { render, requests } = await fixture(t, (scope, number) => {
        if (scope === "published") return page([summary(70 + number, `Published journey ${number}`)], number === 1);
        if (number === 1) return page([summary(81, "Draft journey one")], true);
        attempts.drafts += 1;
        return attempts.drafts === 1 ? failure() : page([summary(82, "Draft journey two")]);
    });
    render().button("Load more Boards").onClick!();
    await flush();
    assert.match(render().markup, /Published journey 1/);
    assert.match(render().markup, /Published journey 2/);
    assert.match(render().markup, /Drafts could not be loaded/);
    assert.doesNotMatch(render().markup, /Draft journey one|Load more Boards/);

    render().button("Drafts").onClick!();
    assert.match(render().markup, /Draft journey one/);
    assert.doesNotMatch(render().markup, /Published journey/);
    assert.ok(render().button("Load more Boards"));
    render().button("Retry unavailable pages").onClick!();
    await flush();
    assert.deepEqual(requests, ["drafts:1", "published:1", "drafts:2", "published:2", "drafts:2"]);
    assert.match(render().markup, /Draft journey one/);
    assert.match(render().markup, /Draft journey two/);
    assert.match(render().markup, /2 drafts/);
    assert.doesNotMatch(
        render().markup,
        /Published journey|could not be loaded|Retry unavailable pages|Load more Boards/
    );
    render().button("Published").onClick!();
    assert.match(render().markup, /Published journey 2/);
    assert.doesNotMatch(render().markup, /Draft journey|Load more Boards/);
});
