import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import React, { Children, isValidElement, type ReactNode } from "react";
import ActivityPhotoSearch from "../src/components/features/boards/ActivityPhotoSearch";
import type { ProviderPhoto } from "../src/lib/providers";

type Props = {
    children?: ReactNode;
    "aria-label"?: string;
    disabled?: boolean;
    onClick?: () => void;
    onChange?: (event: { target: { value: string } }) => void;
    onSubmit?: (event: { preventDefault: () => void }) => void;
};
function nodes(node: ReactNode): Array<{ type: unknown; props: Props }> {
    if (!isValidElement<Props>(node)) return [];
    return [node, ...Children.toArray(node.props.children).flatMap(nodes)];
}
function text(node: ReactNode): string {
    if (Array.isArray(node)) return node.map(text).join("");
    return typeof node === "string" || typeof node === "number"
        ? String(node)
        : isValidElement<Props>(node)
          ? Children.toArray(node.props.children).map(text).join("")
          : "";
}
function photo(id: string): ProviderPhoto {
    return {
        id,
        url: `https://images.unsplash.com/${id}`,
        thumbnailUrl: `https://images.unsplash.com/${id}?w=400`,
        alt: `${id} photo`,
        width: 1600,
        height: 2400,
        photographer: "Photographer",
        photographerUrl: "https://unsplash.com/@photographer",
        sourceUrl: `https://unsplash.com/photos/${id}`
    };
}
function harness(context: TestContext) {
    const cells: Array<{ value: unknown }> = [];
    const cleanups: Array<() => void> = [];
    const cursor = { index: 0 };
    const cell = (initial: unknown) => cells[cursor.index++] ?? (cells[cursor.index - 1] = { value: initial });
    context.mock.method(React, "useState", ((initial: unknown) => {
        const slot = cell(initial);
        return [
            slot.value,
            (next: unknown) => {
                slot.value = typeof next === "function" ? next(slot.value) : next;
            }
        ];
    }) as typeof React.useState);
    context.mock.method(
        React,
        "useRef",
        ((initial: unknown) => cell({ current: initial }).value) as typeof React.useRef
    );
    context.mock.method(React, "useEffect", (effect: () => void | (() => void)) => {
        const cleanup = effect();
        if (cleanup) cleanups.push(cleanup);
    });
    const requests: Array<{ url: URL; init?: RequestInit; resolve: (response: Response) => void }> = [];
    context.mock.method(
        globalThis,
        "fetch",
        (input: string | URL | Request, init?: RequestInit) =>
            new Promise<Response>((resolve) => requests.push({ url: new URL(String(input)), init, resolve }))
    );
    const selected: ProviderPhoto[] = [];
    const previews: Array<{ photos: ProviderPhoto[]; index: number }> = [];
    const selectedIds: string[] = [];
    function render() {
        cursor.index = 0;
        return nodes(
            ActivityPhotoSearch({
                selectedIds,
                onSelect: (value) => selected.push(value),
                onPreview: (photos, index) => previews.push({ photos, index })
            })
        );
    }
    function change(value: string) {
        render()
            .find((node) => node.type === "input")
            ?.props.onChange?.({ target: { value } });
    }
    function submit() {
        render()
            .find((node) => node.type === "form")
            ?.props.onSubmit?.({ preventDefault() {} });
    }
    function button(name: RegExp) {
        const button = render().find(
            (node) => node.type === "button" && name.test(node.props["aria-label"] ?? text(node.props.children))
        );
        assert.ok(button, `Expected button ${name}`);
        return button.props;
    }
    async function respond(index: number, data: unknown, status = 200) {
        requests[index].resolve(
            Response.json(status === 200 ? { data } : { error: { message: "Provider unavailable" } }, { status })
        );
        await new Promise(setImmediate);
    }
    return {
        render,
        change,
        submit,
        button,
        respond,
        requests,
        selected,
        selectedIds,
        previews,
        unmount: () => cleanups.forEach((cleanup) => cleanup())
    };
}

test("previewing a search result delegates the ordered photos and clicked index to the activity editor", async (context) => {
    const ui = harness(context);
    ui.change("boats");
    ui.submit();
    const photos = [photo("first"), photo("second")];
    await ui.respond(0, { query: "boats", page: 1, pageSize: 12, total: 2, totalPages: 1, photos });
    ui.button(/^Enlarge second photo$/).onClick?.();
    assert.deepEqual(ui.previews, [{ photos, index: 1 }]);
    assert.deepEqual(ui.selected, []);
    assert.equal(ui.requests.length, 1, "Previewing must not select a photo or spend provider quota");
});

test("manual photo search waits for submit and pagination retains submitted words while a new query resets page one", async (context) => {
    const ui = harness(context);
    ui.change("  red sailing boat  ");
    assert.equal(ui.requests.length, 0, "Typing must not spend search quota");
    ui.submit();
    assert.equal(ui.requests[0].url.searchParams.get("q"), "red sailing boat");
    assert.equal(ui.requests[0].url.searchParams.get("page"), "1");
    await ui.respond(0, {
        query: "red sailing boat",
        page: 1,
        pageSize: 12,
        total: 25,
        totalPages: 3,
        photos: [photo("boat")]
    });
    assert.equal(ui.button(/Previous/).disabled, true);
    ui.button(/Next/).onClick?.();
    assert.equal(ui.requests[1].url.searchParams.get("q"), "red sailing boat");
    assert.equal(ui.requests[1].url.searchParams.get("page"), "2");
    await ui.respond(1, {
        query: "red sailing boat",
        page: 2,
        pageSize: 12,
        total: 25,
        totalPages: 3,
        photos: [photo("boat-two")]
    });
    ui.change("alpine sunrise");
    assert.equal(ui.requests.length, 2);
    assert.ok(!ui.render().some((node) => node.props["aria-label"] === "Enlarge boat-two photo"));
    ui.submit();
    assert.equal(ui.requests[2].url.searchParams.get("q"), "alpine sunrise");
    assert.equal(ui.requests[2].url.searchParams.get("page"), "1");
    assert.equal(ui.selected.length, 0, "Search/preview never attach a photo");
});

test("query changes and unmount cancel old requests and stale replies cannot replace current results", async (context) => {
    const ui = harness(context);
    ui.change("old boats");
    ui.submit();
    ui.change("new mountains");
    assert.equal(ui.requests[0].init?.signal?.aborted, true);
    ui.submit();
    await ui.respond(1, {
        query: "new mountains",
        page: 1,
        pageSize: 12,
        total: 1,
        totalPages: 1,
        photos: [photo("mountain")]
    });
    await ui.respond(0, {
        query: "old boats",
        page: 1,
        pageSize: 12,
        total: 1,
        totalPages: 1,
        photos: [photo("stale-boat")]
    });
    assert.ok(ui.render().some((node) => node.props["aria-label"] === "Enlarge mountain photo"));
    assert.ok(!ui.render().some((node) => node.props["aria-label"] === "Enlarge stale-boat photo"));
    ui.change("another query");
    ui.submit();
    ui.unmount();
    assert.equal(ui.requests[2].init?.signal?.aborted, true);
});

test("explicit Add photo selects the canonical photo once, retains existing attachments on failure and disables duplicates", async (context) => {
    const ui = harness(context);
    ui.change("boats");
    ui.submit();
    await ui.respond(0, { query: "boats", page: 1, pageSize: 12, total: 1, totalPages: 1, photos: [photo("boat")] });
    ui.button(/^Add photo$/).onClick?.();
    assert.equal(ui.requests[1].init?.method, "POST");
    assert.deepEqual(JSON.parse(String(ui.requests[1].init?.body)), { photoId: "boat" });
    assert.equal(ui.button(/^Add photo$/).disabled, true);
    const canonical = { ...photo("boat"), photographer: "Canonical Photographer", context: null };
    await ui.respond(1, canonical);
    assert.deepEqual(ui.selected, [canonical]);
    ui.selectedIds.push("boat");
    assert.equal(ui.button(/^Added$/).disabled, true);
    ui.button(/^Added$/).onClick?.();
    assert.equal(ui.requests.length, 2);
    ui.change("new search");
    ui.submit();
    await ui.respond(2, null, 503);
    assert.deepEqual(ui.selected, [canonical], "Provider failure must preserve selected media");
    assert.ok(ui.render().some((node) => node.type === "p" && /Provider unavailable/.test(text(node.props.children))));
});
