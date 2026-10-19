import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import React, { Children, createElement, isValidElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import BoardCreator from "../src/components/features/boards/BoardCreator";
import BoardPublishPanel from "../src/components/features/boards/BoardPublishPanel";
import BoardImageIntake from "../src/components/features/boards/BoardImageIntake";
import CreatorDeleteDialog from "../src/components/features/boards/CreatorDeleteDialog";
import ConfirmDialog from "../src/components/ui/ConfirmDialog";
import type { BoardDocument } from "../src/lib/board-creator-api";

type Props = { children?: ReactNode; [key: string]: unknown };
const noop = () => {};
const flush = () => new Promise<void>((resolve) => setImmediate(resolve));

function nodes(node: ReactNode): Array<{ type: unknown; props: Props }> {
    if (!isValidElement<Props>(node)) return [];
    return [{ type: node.type, props: node.props }, ...Children.toArray(node.props.children).flatMap(nodes)];
}

// Capture production handlers with persistent hook state, without mounting browser-only children.
function mount(renderComponent: () => ReactNode, runEffects = false) {
    const states: unknown[] = [];
    const refs: Array<{ current: unknown }> = [];
    const effects: Array<() => void | (() => void)> = [];
    const mounted = { value: false };
    const destinations: string[] = [];
    const router = {
        bfcacheId: "board-deletion-test",
        back: noop,
        forward: noop,
        refresh: noop,
        push: (url: string) => assert.fail(`Unexpected push to ${url}`),
        replace: (url: string) => destinations.push(url),
        prefetch: noop
    };
    function render() {
        const cursor = { state: 0, ref: 0 };
        const captured: { tree: ReactNode } = { tree: null };
        function Probe() {
            const original = { useState: React.useState, useRef: React.useRef, useEffect: React.useEffect };
            React.useState = ((initial: unknown) => {
                const index = cursor.state++;
                if (!(index in states)) states[index] = typeof initial === "function" ? initial() : initial;
                return [
                    states[index],
                    (next: unknown) => {
                        states[index] = typeof next === "function" ? next(states[index]) : next;
                    }
                ];
            }) as typeof React.useState;
            React.useRef = ((initial: unknown) => (refs[cursor.ref++] ??= { current: initial })) as typeof React.useRef;
            React.useEffect = (effect) => {
                if (!mounted.value && runEffects) effects.push(effect);
            };
            try {
                captured.tree = renderComponent();
                return null;
            } finally {
                Object.assign(React, original);
            }
        }
        renderToStaticMarkup(createElement(AppRouterContext.Provider, { value: router }, createElement(Probe)));
        if (!mounted.value) {
            mounted.value = true;
            effects.forEach((effect) => effect());
        }
        return nodes(captured.tree);
    }
    return { render, destinations };
}

function board(status: "draft" | "published" = "draft", canManageBoard = true): BoardDocument {
    return {
        boardId: 47,
        revision: 3,
        title: "My remixed journey",
        description: null,
        status,
        visibility: "public",
        author: { username: "owner", bio: "", photo: null },
        coverImageId: null,
        tagIds: [],
        tags: [],
        imageIds: [],
        images: [],
        days: [],
        permissions: { canEditContent: true, canManageBoard },
        createdAt: "2026-10-19T10:00:00Z",
        updatedAt: "2026-10-19T10:00:00Z"
    };
}

const panelProps = {
    expectedStatus: "draft" as const,
    savedBoard: board(),
    disabled: false,
    saving: null,
    uploading: false,
    message: "",
    error: "",
    onSave: noop,
    onDelete: noop
};

test("saved draft and published owners receive the deletion link beneath View saved Board", () => {
    for (const status of ["draft", "published"] as const) {
        const markup = renderToStaticMarkup(
            createElement(BoardPublishPanel, {
                ...panelProps,
                savedBoard: board(status),
                expectedStatus: status
            })
        );
        assert.match(markup, />Delete Board<\/button>/i);
        assert.ok(markup.indexOf("View saved Board") < markup.indexOf("Delete Board"));
        const deletion = markup.match(/<button[^>]*>Delete Board<\/button>/i)?.[0] ?? "";
        assert.match(deletion, /underline/);
        assert.match(deletion, /hover:text-red-500/);
    }
});

test("unsaved Boards and collaborator editors have no deletion control", () => {
    for (const savedBoard of [null, board("published", false)]) {
        const markup = renderToStaticMarkup(createElement(BoardPublishPanel, { ...panelProps, savedBoard }));
        assert.doesNotMatch(markup, /Delete Board/i);
    }
});

test("saving, uploading and disabled states lock the destructive link and save controls", () => {
    for (const pending of [{ saving: "draft" as const }, { uploading: true }, { disabled: true }]) {
        const tree = nodes(BoardPublishPanel({ ...panelProps, ...pending }));
        const controls = tree.filter((node) => node.type === "button");
        assert.ok(controls.length >= 2);
        for (const control of controls) assert.equal(control.props.disabled, true);
    }
});

function dialog(context: TestContext, response: (init: RequestInit) => Promise<Response>) {
    const requests: RequestInit[] = [];
    void globalThis.fetch;
    context.mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
        assert.equal(new URL(String(input)).pathname, "/api/v1/boards/47");
        assert.ok(init);
        requests.push(init);
        return response(init);
    });
    const closed: boolean[] = [];
    const busy: boolean[] = [];
    const page = mount(() =>
        CreatorDeleteDialog({
            boardId: 47,
            onClose: () => closed.push(true),
            onDeletingChange: (value) => busy.push(value)
        })
    );
    const confirmation = () => {
        const found = page.render().find((node) => node.type === ConfirmDialog);
        assert.ok(found, "Deletion must use the shared confirmation dialog");
        return found.props;
    };
    return { ...page, confirmation, requests, closed, busy };
}

test("canceling the permanent-deletion warning leaves the Board untouched", (context) => {
    const page = dialog(context, async () => assert.fail("Cancel must not delete"));
    const confirmation = page.confirmation();
    assert.match(String(confirmation.description), /(?:permanent|cannot be undone)/i);
    assert.match(String(confirmation.description), /activit/i);
    (confirmation.onCancel as () => void)();
    assert.deepEqual(page.closed, [true]);
    assert.equal(page.requests.length, 0);
    assert.deepEqual(page.destinations, []);
});

test("confirmed deletion sends one credentialed DELETE and only leaves after success", async (context) => {
    const pending: { resolve?: (response: Response) => void } = {};
    const page = dialog(
        context,
        () =>
            new Promise<Response>((resolve) => {
                pending.resolve = resolve;
            })
    );
    const confirm = page.confirmation().onConfirm as () => unknown;
    const first = confirm();
    confirm();
    assert.equal(page.requests.length, 1, "Repeated confirmation must not send duplicate mutations");
    assert.equal(page.requests[0].method, "DELETE");
    assert.equal(page.requests[0].credentials, "include");
    assert.equal(page.confirmation().loading, true);
    assert.deepEqual(page.destinations, []);
    (page.confirmation().onCancel as () => void)();
    assert.deepEqual(page.closed, [], "Pending deletion cannot be dismissed");
    assert.ok(pending.resolve);
    pending.resolve(new Response(null, { status: 204 }));
    await first;
    await flush();
    assert.deepEqual(page.destinations, ["/boards"]);
    assert.equal(page.busy[0], true);
});

test("failed deletion retains the warning with feedback and permits a successful retry", async (context) => {
    const count = { value: 0 };
    const page = dialog(context, async () =>
        ++count.value === 1
            ? Response.json({ error: { message: "You cannot delete this Board." } }, { status: 403 })
            : new Response(null, { status: 204 })
    );
    await (page.confirmation().onConfirm as () => unknown)();
    await flush();
    const failed = page.confirmation();
    assert.ok(failed.error);
    assert.equal(failed.loading, false);
    assert.deepEqual(page.closed, []);
    assert.deepEqual(page.destinations, []);
    assert.equal(page.busy.at(-1), false);
    await (failed.onConfirm as () => unknown)();
    await flush();
    assert.equal(page.requests.length, 2);
    assert.deepEqual(page.destinations, ["/boards"]);
});

test("the production editor opens confirmation without deleting and locks editing until cancellation", async (context) => {
    void globalThis.fetch;
    context.mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
        assert.notEqual(init?.method, "DELETE", "Opening the warning must not mutate the Board");
        const path = new URL(String(input)).pathname;
        if (path === "/api/v1/tags") return Response.json({ data: [] });
        assert.equal(path, "/api/v1/boards/47");
        return Response.json({ data: board() });
    });
    const page = mount(() => BoardCreator({ initialBoardId: 47 }), true);
    page.render();
    await flush();
    const publish = page.render().find((node) => node.type === BoardPublishPanel);
    assert.ok(publish);
    assert.equal(typeof publish.props.onDelete, "function");
    (publish.props.onDelete as () => void)();
    const pending = page.render();
    const warning = pending.find((node) => node.type === CreatorDeleteDialog);
    assert.ok(warning);
    assert.equal(warning.props.boardId, 47);
    assert.ok(pending.some((node) => node.type === "fieldset" && node.props.disabled === true));
    assert.equal(pending.find((node) => node.type === BoardImageIntake)?.props.disabled, true);
    (warning.props.onDeletingChange as (value: boolean) => void)(true);
    assert.equal(page.render().find((node) => node.type === BoardPublishPanel)?.props.disabled, true);
    (warning.props.onDeletingChange as (value: boolean) => void)(false);
    (warning.props.onClose as () => void)();
    const canceled = page.render();
    assert.equal(
        canceled.some((node) => node.type === CreatorDeleteDialog),
        false
    );
    assert.ok(canceled.some((node) => node.type === "fieldset" && node.props.disabled === false));
});
