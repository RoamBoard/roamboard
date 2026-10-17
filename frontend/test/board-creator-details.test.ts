import assert from "node:assert/strict";
import test from "node:test";
import { Children, createElement, isValidElement, type ComponentProps, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import BoardDiscoveryDetails from "../src/components/features/boards/BoardDiscoveryDetails";
import BoardTagPicker from "../src/components/features/boards/BoardTagPicker";
import BoardPublishPanel from "../src/components/features/boards/BoardPublishPanel";
import { listBoardTags, saveBoardDocument, toBoardWrite, type BoardDocument } from "../src/lib/board-creator-api";
import type { BoardCreatorPayload, BoardStatus } from "../src/types/board-creator";

function draft(): BoardCreatorPayload {
    return {
        title: "",
        description: "",
        status: "draft",
        visibility: "collaborators",
        coverImageId: null,
        tags: [],
        days: [{ id: "day-local", serverDayId: 12, dayNumber: 1, date: null, pins: [] }],
        images: []
    };
}

function savedBoard(status: BoardStatus = "draft"): BoardDocument {
    return {
        ...toBoardWrite(draft(), [], new Set()),
        status,
        boardId: 35,
        author: { username: "owner", bio: "", photo: null },
        revision: 4,
        permissions: { canEditContent: true, canManageBoard: true },
        tags: [],
        images: [],
        days: [{ dayId: 12, dayNumber: 1, date: null, activities: [] }],
        createdAt: "2026-10-20T09:00:00Z",
        updatedAt: "2026-10-20T10:00:00Z"
    };
}

type ControlProps = {
    children?: ReactNode;
    type?: string;
    name?: string;
    value?: string;
    checked?: boolean;
    disabled?: boolean;
    "aria-label"?: string;
    onClick?: () => void;
    onChange?: () => void;
};

function controls(node: ReactNode): ControlProps[] {
    if (!isValidElement<ControlProps>(node)) return [];
    return [node.props, ...Children.toArray(node.props.children).flatMap(controls)];
}

function panelProps(
    overrides: Partial<ComponentProps<typeof BoardPublishPanel>> = {}
): ComponentProps<typeof BoardPublishPanel> {
    return {
        expectedStatus: "draft",
        savedBoard: null,
        disabled: false,
        saving: null,
        uploading: false,
        message: "",
        error: "",
        onSave: () => {},
        ...overrides
    };
}

test("visibility uses the canonical three access values and stays controlled by the parent", () => {
    const selected: string[] = [];
    const props = {
        tags: [],
        allowedTags: ["Coffee"],
        visibility: "friends" as const,
        onTagsChange: () => {},
        onVisibilityChange: (value: string) => {
            selected.push(value);
        }
    };
    const radios = controls(BoardDiscoveryDetails(props)).filter((control) => control.type === "radio");
    assert.deepEqual(
        radios.map((control) => control.value),
        ["collaborators", "friends", "public"]
    );
    assert.deepEqual(
        radios.filter((control) => control.checked).map((control) => control.value),
        ["friends"]
    );
    for (const radio of radios) radio.onChange?.();
    assert.deepEqual(selected, ["collaborators", "friends", "public"]);
    radios.find((radio) => radio.checked)?.onClick?.();
    assert.deepEqual(selected, ["collaborators", "friends", "public", "friends"]);
    assert.deepEqual(
        controls(BoardDiscoveryDetails(props))
            .filter((control) => control.checked)
            .map((control) => control.value),
        ["friends"]
    );
    const markup = renderToStaticMarkup(createElement(BoardDiscoveryDetails, props));
    assert.match(markup, /Private/);
    assert.match(markup, /Friends/);
    assert.match(markup, /Public/);
    assert.match(markup, /Drafts[\s\S]*only to you/i);
});

test("published editors can keep editing tags while visibility remains owner-only", () => {
    const props = {
        tags: ["Coffee"],
        allowedTags: ["Coffee", "Museums"],
        visibility: "public" as const,
        canChangeVisibility: false,
        onTagsChange: () => {},
        onVisibilityChange: () => {}
    };
    const radios = controls(BoardDiscoveryDetails(props)).filter((control) => control.type === "radio");
    assert.equal(radios.length, 3);
    assert.ok(radios.every((control) => control.disabled));
    const markup = renderToStaticMarkup(createElement(BoardDiscoveryDetails, props));
    assert.match(markup, /Only the Board owner can change visibility/);
    const remove = markup.match(/<button[^>]*aria-label="Remove Coffee"[^>]*>/)?.[0];
    assert.ok(remove, "Editors must retain access to tag editing");
    assert.doesNotMatch(remove, / disabled=""/);
});

function textContent(node: ReactNode): string {
    if (typeof node === "string" || typeof node === "number") return String(node);
    if (!isValidElement<{ children?: ReactNode }>(node)) return "";
    return Children.toArray(node.props.children).map(textContent).join("");
}

function panelButtons(props: ComponentProps<typeof BoardPublishPanel>) {
    return controls(BoardPublishPanel(props)).filter((control) => control.type === "button");
}

test("new and existing drafts expose distinct draft-save and publish actions", () => {
    for (const board of [null, savedBoard()]) {
        const saved: BoardStatus[] = [];
        const props = panelProps({
            savedBoard: board,
            onSave: (status) => {
                saved.push(status);
            }
        });
        const buttons = panelButtons(props);
        const draftButton = buttons.find((button) =>
            textContent(button.children).toLowerCase().includes("save as draft")
        );
        const publishButton = buttons.find((button) => button["aria-label"] === "Publish Board");
        assert.ok(draftButton);
        assert.ok(publishButton);
        assert.ok(!draftButton.disabled && !publishButton.disabled);
        draftButton.onClick?.();
        publishButton.onClick?.();
        assert.deepEqual(saved, ["draft", "published"]);
    }
});

test("published editing offers Save changes and cannot downgrade the Board to a draft", () => {
    const saved: BoardStatus[] = [];
    const props = panelProps({
        expectedStatus: "published",
        savedBoard: savedBoard("published"),
        onSave: (status) => {
            saved.push(status);
        }
    });
    const buttons = panelButtons(props);
    assert.equal(buttons.length, 1);
    assert.match(textContent(buttons[0].children), /save changes/i);
    buttons[0].onClick?.();
    assert.deepEqual(saved, ["published"]);
    const markup = renderToStaticMarkup(createElement(BoardPublishPanel, props));
    assert.doesNotMatch(markup, /Save as draft/);
});

test("loading, uploading and either active save lock all publication actions", () => {
    for (const state of [
        { disabled: true },
        { uploading: true },
        { saving: "draft" as const },
        { saving: "published" as const }
    ]) {
        const saved: BoardStatus[] = [];
        const props = panelProps({
            ...state,
            onSave: (status) => {
                saved.push(status);
            }
        });
        const buttons = panelButtons(props);
        assert.ok(buttons.length > 0);
        assert.ok(
            buttons.every((button) => button.disabled),
            `Actions must be disabled during ${JSON.stringify(state)}`
        );
        for (const button of buttons) button.onClick?.();
        assert.deepEqual(saved, []);
    }
});

test("a Board already published from this draft flow cannot be saved or published again", () => {
    const buttons = panelButtons(panelProps({ savedBoard: savedBoard("published") }));
    assert.ok(buttons.every((button) => button.disabled));
});

test("publication feedback distinguishes confirmed saving from errors and links only real saved Boards", () => {
    const initial = renderToStaticMarkup(createElement(BoardPublishPanel, panelProps()));
    assert.doesNotMatch(initial, /href="\/boards\/35"/);
    const confirmed = renderToStaticMarkup(
        createElement(
            BoardPublishPanel,
            panelProps({ savedBoard: savedBoard("published"), message: "Museum trip is published." })
        )
    );
    assert.match(confirmed, /role="status"/);
    assert.match(confirmed, /Museum trip is published\./);
    assert.match(confirmed, /href="\/boards\/35"/);
    const rejected = renderToStaticMarkup(
        createElement(
            BoardPublishPanel,
            panelProps({
                error: "Confirm the photo location before publishing.",
                message: "An earlier save succeeded."
            })
        )
    );
    assert.match(rejected, /role="alert"/);
    assert.match(rejected, /Confirm the photo location before publishing\./);
    assert.doesNotMatch(rejected, /An earlier save succeeded\./);
    assert.match(rejected, /href="#board-title"/);
    assert.match(rejected, /href="#day-plan"/);
    assert.doesNotMatch(rejected, /href="\/boards\//);
});

function tagMarkup(overrides: Partial<ComponentProps<typeof BoardTagPicker>> = {}) {
    return renderToStaticMarkup(
        createElement(BoardTagPicker, {
            values: ["Coffee"],
            suggestions: ["Coffee", "Museums", "Nature", "Food"],
            onChange: () => {},
            ...overrides
        })
    );
}

function tagInput(markup: string) {
    const input = markup.match(/<input[^>]*aria-label="Tags"[^>]*>/)?.[0];
    assert.ok(input, "The tag search must be available through its labelled input");
    return input;
}

test("tag search shows controlled selections and exposes accessible catalog search", () => {
    const markup = tagMarkup();
    assert.match(markup, /aria-label="1 of 3 tags selected"/);
    assert.match(markup, /aria-label="Selected Board tags"/);
    assert.match(markup, /aria-label="Remove Coffee"/);
    assert.match(tagInput(markup), /role="combobox"/);
    assert.match(tagInput(markup), /aria-label="Tags"/);
    assert.doesNotMatch(tagInput(markup), / disabled=""/);
    assert.match(markup, /never creates a new tag/);
    const updated = tagMarkup({ values: ["Museums", "Nature"] });
    assert.match(updated, /aria-label="2 of 3 tags selected"/);
    assert.doesNotMatch(updated, /aria-label="Remove Coffee"/);
    assert.match(updated, /aria-label="Remove Museums"/);
});

test("three selected tags disable further additions but leave selected tags removable", () => {
    const markup = tagMarkup({ values: ["Coffee", "Museums", "Nature"] });
    assert.match(tagInput(markup), / disabled=""/);
    assert.match(markup, /Three tags selected\. Remove one/);
    for (const name of ["Coffee", "Museums", "Nature"]) {
        const remove = markup.match(new RegExp(`<button[^>]*aria-label="Remove ${name}"[^>]*>`))?.[0];
        assert.ok(remove);
        assert.doesNotMatch(remove, / disabled=""/);
    }
});

test("loading and failed tag catalogs preserve selected tags and disable new choices", () => {
    for (const state of [{ loading: true }, { error: "The tag catalog is unavailable.", onRetry: () => {} }]) {
        const markup = tagMarkup(state);
        assert.match(tagInput(markup), / disabled=""/);
        assert.match(markup, /aria-label="Remove Coffee"/);
        if ("loading" in state) {
            assert.match(markup, /role="status"/);
            assert.match(markup, /Loading the Board tag catalog/);
        } else {
            assert.match(markup, /role="alert"/);
            assert.match(markup, /The tag catalog is unavailable\./);
            assert.match(markup, />Retry tags<\/button>/);
        }
    }
    const empty = tagMarkup({ values: [], suggestions: [] });
    assert.match(empty, /No tags are available/);
    assert.doesNotMatch(empty, /Remove Coffee/);
});

test("disabled details prevent both tag editing and owner visibility changes", () => {
    const selected: string[] = [];
    const props = {
        tags: ["Coffee"],
        allowedTags: ["Coffee", "Museums"],
        visibility: "public" as const,
        disabled: true,
        onTagsChange: () => {},
        onVisibilityChange: (value: string) => {
            selected.push(value);
        }
    };
    const radios = controls(BoardDiscoveryDetails(props)).filter((control) => control.type === "radio");
    assert.ok(radios.every((radio) => radio.disabled));
    for (const radio of radios) radio.onChange?.();
    assert.deepEqual(selected, []);
    const markup = renderToStaticMarkup(createElement(BoardDiscoveryDetails, props));
    assert.match(tagInput(markup), / disabled=""/);
    assert.match(markup.match(/<button[^>]*aria-label="Remove Coffee"[^>]*>/)?.[0] ?? "", / disabled=""/);
});

test("tag vocabulary comes from the API and selected names become backend-generated IDs", async (t) => {
    const requests: string[] = [];
    t.mock.method(globalThis, "fetch", async (input: string, init: RequestInit) => {
        requests.push(new URL(input).pathname);
        assert.equal(init.credentials, "include");
        return Response.json({
            data: [
                { tagId: 811, name: "Museums" },
                { tagId: 43, name: "Coffee" }
            ]
        });
    });
    const vocabulary = await listBoardTags();
    const source = { ...draft(), tags: ["Coffee", "Museums"], visibility: "friends" as const };
    const write = toBoardWrite(source, vocabulary, new Set());
    assert.deepEqual(requests, ["/api/v1/tags"]);
    assert.deepEqual(write.tagIds, [43, 811]);
    assert.equal(write.visibility, "friends");
    assert.equal(write.title, "");
    assert.deepEqual(write.days[0].activities, []);
    assert.throws(
        () => toBoardWrite({ ...source, tags: ["Unlisted custom tag"] }, vocabulary, new Set()),
        /allowed list/
    );
    assert.deepEqual(source.tags, ["Coffee", "Museums"]);
});

test("save helper sends the saved revision and current visibility without mutating edits on conflict", async (t) => {
    const board = savedBoard();
    const input = toBoardWrite({ ...draft(), title: "My revised itinerary", visibility: "public" }, [], new Set());
    const before = structuredClone(input);
    const calls: Array<{ path: string; method?: string; body: Record<string, unknown> }> = [];
    t.mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
        assert.equal(init.credentials, "include");
        calls.push({ path: new URL(url).pathname, method: init.method, body: JSON.parse(String(init.body)) });
        return Response.json(
            { error: { code: "REVISION_CONFLICT", message: "Board changed in another session." } },
            { status: 409 }
        );
    });
    await assert.rejects(saveBoardDocument(input, board), /changed in another session/);
    assert.equal(calls[0].path, "/api/v1/boards/35");
    assert.equal(calls[0].method, "PUT");
    assert.equal(calls[0].body.revision, 4);
    assert.equal(calls[0].body.visibility, "public");
    assert.equal(calls[0].body.title, "My revised itinerary");
    assert.deepEqual(input, before);
    assert.equal(board.revision, 4);
});
