import assert from "node:assert/strict";
import test from "node:test";
import {
    Children,
    createElement,
    isValidElement,
    useState,
    type ReactNode,
    type KeyboardEvent,
    type PointerEvent
} from "react";
import { renderToStaticMarkup } from "react-dom/server";
import PlannerDayColumn from "../src/components/features/boards/PlannerDayColumn";
import type { BoardDayDraft, BoardPinDraft } from "../src/types/board-creator";

type Control = {
    children?: ReactNode;
    "aria-label"?: string;
    onClick?: () => void;
    onKeyDown?: (event: KeyboardEvent<HTMLButtonElement>) => void;
    onPointerDown?: (event: PointerEvent<HTMLButtonElement>) => void;
    onPointerMove?: (event: PointerEvent<HTMLButtonElement>) => void;
    onPointerUp?: () => void;
    onPointerCancel?: () => void;
};
function controls(node: ReactNode): Array<{ type: unknown; props: Control }> {
    if (!isValidElement<Control>(node)) return [];
    return [node, ...Children.toArray(node.props.children).flatMap(controls)];
}
function activity(id: string): BoardPinDraft {
    return {
        id,
        title: id,
        time: "14:35",
        description: "",
        order: 0,
        category: "activity",
        source: "manual",
        location: null
    };
}
function mount(disabled = false, openPalette = false) {
    const days: BoardDayDraft[] = [
        { id: "one", dayNumber: 1, date: null, pins: [activity("A"), activity("B"), activity("C")] },
        { id: "two", dayNumber: 2, date: null, pins: [activity("D")] }
    ];
    const moved: unknown[][] = [];
    const chosen: string[] = [];
    const palette = { opened: false };
    const capture: { controls: ReturnType<typeof controls> } = { controls: [] };
    function Probe() {
        const tree = PlannerDayColumn({
            day: days[0],
            dayIndex: 0,
            days,
            images: [],
            disabled,
            onMovePin: (...args) => moved.push(args),
            onOpenPin() {},
            onAdd() {},
            onRemoveDay() {},
            onUpdatePin() {},
            onColorChange: (color) => chosen.push(color),
            dragTarget: null,
            onDragTargetChange() {}
        });
        capture.controls = controls(tree);
        if (openPalette && !palette.opened) {
            palette.opened = true;
            capture.controls.find((node) => node.props["aria-label"] === "Choose color for day 1")?.props.onClick?.();
        }
        return tree;
    }
    renderToStaticMarkup(createElement(Probe));
    function press(title: string, key: string, shiftKey = false) {
        const button = capture.controls.find((node) => node.props["aria-label"] === `Edit ${title}`);
        assert.ok(button?.props.onKeyDown, "Activities must expose keyboard ordering");
        const state = { prevented: false, stopped: false };
        button.props.onKeyDown({
            key,
            shiftKey,
            preventDefault: () => {
                state.prevented = true;
            },
            stopPropagation: () => {
                state.stopped = true;
            }
        } as KeyboardEvent<HTMLButtonElement>);
        return state;
    }
    return { press, moved, chosen, controls: capture.controls };
}

test("each day offers thirty named color choices and selection reports a persistable color", () => {
    const palette = mount(false, true);
    const choices = palette.controls.filter((node) => /^Day color \d+$/.test(node.props["aria-label"] ?? ""));
    assert.equal(choices.length, 30);
    assert.equal(new Set(choices.map((choice) => choice.props["aria-label"])).size, 30);
    choices[29].props.onClick?.();
    assert.equal(palette.chosen.length, 1);
    assert.match(palette.chosen[0], /^#[0-9a-f]{6}$/);
});

test("activity keyboard moves preserve exact time and distinguish ordering from changing day", () => {
    const { press, moved } = mount();
    assert.equal(press("B", "ArrowUp").prevented, true);
    press("B", "ArrowDown");
    assert.equal(
        press("B", "ArrowRight", true).stopped,
        true,
        "Changing day must not also navigate the chapter carousel"
    );
    assert.deepEqual(moved, [
        ["B", "one", "14:35", 0],
        ["B", "one", "14:35", 2],
        ["B", "two", "14:35", 1]
    ]);
});

test("activity keyboard moves ignore unavailable neighbors, unmodified sideways keys and locked editing", () => {
    const { press, moved } = mount();
    press("A", "ArrowUp");
    press("C", "ArrowDown");
    press("B", "ArrowLeft", true);
    assert.equal(press("B", "ArrowRight").prevented, false);
    press("B", "ArrowUp", true);
    assert.deepEqual(moved, []);
    const locked = mount(true);
    locked.press("B", "ArrowDown");
    locked.press("B", "ArrowRight", true);
    assert.deepEqual(locked.moved, []);
});

test("touch grips move activities within and across days, while taps, cancellation and locked editing never move", (context) => {
    const previousDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
    const target = { dayId: "two", rows: [200] };
    Object.defineProperty(globalThis, "document", {
        configurable: true,
        value: {
            elementFromPoint: () => ({
                closest: () => ({
                    dataset: { plannerDay: target.dayId },
                    querySelectorAll: () =>
                        target.rows.map((top) => ({ getBoundingClientRect: () => ({ top, height: 100 }) }))
                })
            })
        }
    });
    context.after(() => {
        if (previousDocument) Object.defineProperty(globalThis, "document", previousDocument);
        else Reflect.deleteProperty(globalThis, "document");
    });
    function gesture(options: {
        dayId: string;
        y: number;
        cancel?: boolean;
        disabled?: boolean;
        pointerType?: string;
    }) {
        target.dayId = options.dayId;
        target.rows = options.dayId === "one" ? [0, 100, 200] : [200];
        const moved: unknown[][] = [];
        const captures: number[] = [];
        const progress = { stage: 0 };
        const days: BoardDayDraft[] = [
            { id: "one", dayNumber: 1, date: null, pins: [activity("A"), activity("B"), activity("C")] },
            { id: "two", dayNumber: 2, date: null, pins: [activity("D")] }
        ];
        function Probe() {
            const [dragTarget, onDragTargetChange] = useState<{ dayId: string; index: number } | null>(null);
            const tree = PlannerDayColumn({
                day: days[0],
                dayIndex: 0,
                days,
                images: [],
                disabled: options.disabled ?? false,
                onMovePin: (...args) => moved.push(args),
                onOpenPin() {},
                onAdd() {},
                onRemoveDay() {},
                onUpdatePin() {},
                onColorChange() {},
                dragTarget,
                onDragTargetChange
            });
            const grip = controls(tree).find((node) => node.props["aria-label"] === "Drag B");
            assert.ok(grip?.props.onPointerDown);
            if (progress.stage === 0) {
                progress.stage = 1;
                grip.props.onPointerDown({
                    pointerType: options.pointerType ?? "touch",
                    clientX: 10,
                    clientY: 10,
                    pointerId: 7,
                    stopPropagation() {},
                    currentTarget: { setPointerCapture: (id: number) => captures.push(id) }
                } as unknown as PointerEvent<HTMLButtonElement>);
                grip.props.onPointerMove?.({ clientX: 10, clientY: options.y } as PointerEvent<HTMLButtonElement>);
                if (options.y < 18 || options.disabled || options.pointerType === "mouse") grip.props.onPointerUp?.();
            } else if (progress.stage === 1) {
                progress.stage = 2;
                if (options.cancel) grip.props.onPointerCancel?.();
                grip.props.onPointerUp?.();
            }
            return tree;
        }
        renderToStaticMarkup(createElement(Probe));
        return { moved, captures };
    }
    const across = gesture({ dayId: "two", y: 80 });
    assert.deepEqual(across.moved, [["B", "two", "14:35", 0]]);
    assert.deepEqual(across.captures, [7], "Touch keeps pointer capture while the finger crosses cards");
    assert.deepEqual(gesture({ dayId: "one", y: 350 }).moved, [["B", "one", "14:35", 2]]);
    assert.deepEqual(gesture({ dayId: "two", y: 15 }).moved, [], "A tap must not become a drag");
    assert.deepEqual(gesture({ dayId: "two", y: 80, cancel: true }).moved, []);
    assert.deepEqual(gesture({ dayId: "two", y: 80, disabled: true }).moved, []);
    assert.deepEqual(
        gesture({ dayId: "two", y: 80, pointerType: "mouse" }).captures,
        [],
        "Mouse retains native card dragging"
    );
});
