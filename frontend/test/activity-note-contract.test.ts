import assert from "node:assert/strict";
import test from "node:test";
import { Children, createElement, isValidElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import ActivityEditorDialog from "../src/components/features/boards/ActivityEditorDialog";
import { activityNoteError, activityNoteLength } from "../src/lib/activity-note";
import type { BoardPinDraft } from "../src/types/board-creator";

test("activity notes count Unicode code points, including emoji and separate combining marks", () => {
    assert.equal(activityNoteLength("\u{1f30d}".repeat(250)), 250);
    assert.equal(activityNoteError("\u{1f30d}".repeat(250)), null);
    assert.ok(activityNoteError("\u{1f30d}".repeat(251)));
    assert.equal(activityNoteLength("e\u0301"), 2);
    assert.equal(activityNoteError(""), null);
});

test("unchanged legacy notes survive unrelated edits but any over-limit replacement requires correction", () => {
    const legacy = "Original travel note. ".repeat(20);
    assert.equal(activityNoteError(legacy, legacy), null);
    assert.ok(activityNoteError(`${legacy}!`, legacy));
    assert.ok(activityNoteError(legacy.slice(0, -1), legacy));
    assert.equal(activityNoteError("x".repeat(250), legacy), null);
    assert.equal(activityNoteError("", legacy), null);
    assert.ok(activityNoteError("x".repeat(251)));
});

const pin: BoardPinDraft = {
    id: "museum",
    serverActivityId: 13,
    title: "Museum",
    description: "Original note",
    time: "10:00",
    order: 0,
    category: "museum",
    source: "manual",
    location: {
        name: "Museum",
        address: "Museum Street",
        city: "Stockholm",
        country: "Sweden",
        countryCode: "SWE",
        latitude: 59.3,
        longitude: 18.1,
        mapboxId: "geoapify:museum"
    }
};

type Props = {
    children?: ReactNode;
    type?: string;
    value?: string;
    disabled?: boolean;
    maxLength?: number;
    onChange?: (event: { target: { value: string } }) => void;
    onClick?: () => void;
};

function elements(node: ReactNode): Array<{ type: unknown; props: Props }> {
    if (!isValidElement<Props>(node)) return [];
    return [{ type: node.type, props: node.props }, ...Children.toArray(node.props.children).flatMap(elements)];
}

function editNote(original: string, replacement?: string, time?: string) {
    const saved: BoardPinDraft[] = [];
    const stage = { value: 0 };
    const rendered: { nodes: ReturnType<typeof elements> } = { nodes: [] };
    function Probe() {
        const wrapper = ActivityEditorDialog({
            pin: { ...pin, description: original },
            images: [],
            remainingUploads: 30,
            onClose() {},
            onSave: (activity) => saved.push(activity),
            onDelete() {},
            onAddImage() {},
            onAssignImage() {},
            onReorderImage() {}
        });
        const tree =
            typeof wrapper.type === "function"
                ? (wrapper.type as (props: unknown) => ReactNode)(wrapper.props)
                : wrapper;
        const nodes = elements(tree);
        rendered.nodes = nodes;
        if (stage.value === 0 && (replacement !== undefined || time !== undefined)) {
            stage.value = 1;
            if (replacement !== undefined) {
                const textarea = nodes.find((node) => node.type === "textarea");
                assert.ok(textarea?.props.onChange);
                textarea.props.onChange({ target: { value: replacement } });
            } else {
                const input = nodes.find((node) => node.type === "input" && node.props.type === "time");
                assert.ok(input?.props.onChange);
                input.props.onChange({ target: { value: time! } });
            }
        } else if (stage.value < 2) {
            stage.value = 2;
            const submit = nodes.find((node) => node.type === "button" && node.props.children === "Save activity");
            assert.ok(submit);
            if (!submit.props.disabled) submit.props.onClick?.();
        }
        return tree;
    }
    const markup = renderToStaticMarkup(createElement(Probe));
    return { saved, markup, nodes: rendered.nodes };
}

test("the real activity editor preserves a legacy note when changing its time", () => {
    const legacy = "Keep this entire historical note. ".repeat(12);
    const result = editNote(legacy, undefined, "11:45");
    assert.equal(result.saved.length, 1);
    assert.equal(result.saved[0]?.time, "11:45");
    assert.equal(result.saved[0]?.description, legacy);
    assert.match(result.markup, /250/);
});

test("the real editor keeps over-limit pasted text visible and prevents saving it", () => {
    const replacement = "x".repeat(251);
    const result = editNote("Short note", replacement);
    assert.deepEqual(result.saved, []);
    assert.equal(result.nodes.find((node) => node.type === "textarea")?.props.value, replacement);
    assert.match(result.markup, /250/);
});

test("the real editor accepts 250 emoji without a UTF-16 maxlength cutting the note in half", () => {
    const replacement = "\u{1f30d}".repeat(250);
    const result = editNote("Short note", replacement);
    assert.equal(result.saved.length, 1);
    assert.equal(result.saved[0]?.description, replacement);
    const maxLength = result.nodes.find((node) => node.type === "textarea")?.props.maxLength;
    assert.ok(maxLength === undefined || maxLength >= replacement.length);
});
