import test from "node:test";
import assert from "node:assert/strict";
import React, { Children, createElement, isValidElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import LanguageEditor, { rankLanguageChoices } from "@/components/features/settings/LanguageEditor";

type ElementProps = {
    children?: ReactNode;
    [key: string]: unknown;
};

function elements(node: ReactNode): Array<{ type: unknown; props: ElementProps }> {
    if (!isValidElement<ElementProps>(node)) return [];
    return [{ type: node.type, props: node.props }, ...Children.toArray(node.props.children).flatMap(elements)];
}

function createStatefulHarness(initialProps: {
    languages?: string[];
    choices?: string[];
    maxLanguages?: number;
    onChangeLanguages?: (languages: string[]) => void;
}) {
    const state: Record<number, unknown> = {};
    const refs: Record<number, { current: unknown }> = {};
    const holder: { tree: ReactNode } = { tree: null };

    const render = (overrideProps: Partial<typeof initialProps> = {}) => {
        const cursor = { state: 0, ref: 0 };
        const original = {
            useState: React.useState,
            useRef: React.useRef
        };

        function Probe() {
            React.useState = ((initial: unknown) => {
                const index = cursor.state++;
                if (!(index in state)) {
                    state[index] = typeof initial === "function" ? (initial as () => unknown)() : initial;
                }
                return [
                    state[index],
                    (next: unknown) => {
                        state[index] =
                            typeof next === "function" ? (next as (prev: unknown) => unknown)(state[index]) : next;
                    }
                ];
            }) as typeof React.useState;

            React.useRef = ((initial: unknown) => {
                const index = cursor.ref++;
                return (refs[index] ??= { current: initial });
            }) as typeof React.useRef;

            try {
                holder.tree = LanguageEditor({
                    languages: initialProps.languages ?? [],
                    onChangeLanguages: initialProps.onChangeLanguages ?? (() => {}),
                    choices: initialProps.choices ?? ["English", "Spanish", "French", "German"],
                    maxLanguages: initialProps.maxLanguages ?? 10,
                    ...overrideProps
                });
                return holder.tree;
            } finally {
                Object.assign(React, original);
            }
        }

        const markup = renderToStaticMarkup(createElement(Probe));
        const nodes = elements(holder.tree);
        return { markup, nodes, tree: holder.tree };
    };

    return { render };
}

test("LanguageEditor renders heading, selected languages, and counter", () => {
    const html = renderToStaticMarkup(
        createElement(LanguageEditor, {
            languages: ["English", "Spanish"],
            onChangeLanguages: () => {},
            choices: ["English", "Spanish", "French", "German"],
            maxLanguages: 10
        })
    );

    assert.ok(html.includes("Languages Spoken"));
    assert.ok(html.includes("(2/10)"));
    assert.ok(html.includes("English"));
    assert.ok(html.includes("Spanish"));
    assert.ok(html.includes("Remove English"));
    assert.ok(html.includes("Remove Spanish"));
});

test("LanguageEditor renders search input with accessible combobox role", () => {
    const html = renderToStaticMarkup(
        createElement(LanguageEditor, {
            languages: ["English"],
            onChangeLanguages: () => {},
            choices: ["English", "Spanish", "French"],
            maxLanguages: 10
        })
    );

    assert.ok(html.includes('role="combobox"'));
    assert.ok(html.includes('placeholder="Search language to add…"'));
    assert.ok(html.includes('aria-label="Open suggestions"'));
});

test("LanguageEditor disables input when maximum languages limit is reached", () => {
    const html = renderToStaticMarkup(
        createElement(LanguageEditor, {
            languages: ["English", "Spanish"],
            onChangeLanguages: () => {},
            choices: ["English", "Spanish", "French", "German"],
            maxLanguages: 2
        })
    );

    assert.ok(html.includes("(2/2)"));
    assert.ok(html.includes("Maximum of 2 languages reached."));
    assert.ok(html.includes("Limit reached (2 max)"));
    assert.ok(html.includes("disabled"));
});

test("rankLanguageChoices prioritizes prefix matches over substring matches", () => {
    const choices = ["Esperanto", "Filipino", "Japanese", "Pashto", "Persian", "Polish", "Portuguese"];
    const ranked = rankLanguageChoices(choices, "p");

    assert.equal(ranked[0], "Pashto");
    assert.equal(ranked[1], "Persian");
    assert.equal(ranked[2], "Polish");
    assert.equal(ranked[3], "Portuguese");
    assert.ok(ranked.indexOf("Portuguese") < ranked.indexOf("Japanese"));
    assert.ok(ranked.indexOf("Polish") < ranked.indexOf("Japanese"));
});

test("rankLanguageChoices excludes already selected languages and matches word starts", () => {
    const choices = ["English", "Mandarin Chinese", "Cantonese"];
    const ranked = rankLanguageChoices(choices, "chi", ["English"]);

    assert.ok(!ranked.includes("English"));
    assert.equal(ranked[0], "Mandarin Chinese");
});

test("removing a language tag emits updated array without that language", () => {
    const emitted: string[][] = [];
    const harness = createStatefulHarness({
        languages: ["English", "Spanish"],
        onChangeLanguages: (langs) => emitted.push(langs),
        choices: ["English", "Spanish", "French"]
    });
    const { nodes } = harness.render();
    const removeBtn = nodes.find((n) => n.props["aria-label"] === "Remove English");
    assert.ok(removeBtn);
    assert.equal(typeof removeBtn.props.onClick, "function");
    (removeBtn.props.onClick as () => void)();
    assert.deepEqual(emitted, [["Spanish"]]);
});

test("typing search query and pressing Enter commits the highlighted language", () => {
    const emitted: string[][] = [];
    const harness = createStatefulHarness({
        languages: ["English"],
        onChangeLanguages: (langs) => emitted.push(langs),
        choices: ["English", "Spanish", "French"]
    });
    const initial = harness.render();
    const input = initial.nodes.find((n) => n.props.role === "combobox");
    assert.ok(input);

    (input.props.onFocus as () => void)();
    (input.props.onChange as (e: unknown) => void)({ target: { value: "spa" } });

    const afterType = harness.render();
    const typedInput = afterType.nodes.find((n) => n.props.role === "combobox");
    assert.ok(typedInput);
    assert.equal(typedInput.props.value, "spa");
    assert.equal(typedInput.props["aria-expanded"], true);

    const prevented = { value: false };
    (typedInput.props.onKeyDown as (e: unknown) => void)({
        key: "Enter",
        preventDefault: () => {
            prevented.value = true;
        }
    });
    assert.equal(prevented.value, true);
    assert.deepEqual(emitted, [["English", "Spanish"]]);

    const afterCommit = harness.render();
    const committedInput = afterCommit.nodes.find((n) => n.props.role === "combobox");
    assert.ok(committedInput);
    assert.equal(committedInput.props.value, "");
    assert.equal(committedInput.props["aria-expanded"], false);
});

test("keyboard navigation updates aria-activedescendant and option IDs", () => {
    const harness = createStatefulHarness({
        languages: [],
        choices: ["English", "Spanish", "French"]
    });
    const initial = harness.render();
    const input = initial.nodes.find((n) => n.props.role === "combobox");
    assert.ok(input);

    (input.props.onFocus as () => void)();
    const openState = harness.render();
    const openInput = openState.nodes.find((n) => n.props.role === "combobox");
    assert.ok(openInput);

    const activeId0 = openInput.props["aria-activedescendant"] as string;
    assert.ok(typeof activeId0 === "string" && activeId0.endsWith("-option-0"));

    const option0 = openState.nodes.find((n) => n.props.id === activeId0);
    assert.ok(option0, "Option matching aria-activedescendant must exist");
    assert.equal(option0.props["aria-selected"], true);

    (openInput.props.onKeyDown as (e: unknown) => void)({ key: "ArrowDown", preventDefault: () => {} });
    const nextState = harness.render();
    const nextInput = nextState.nodes.find((n) => n.props.role === "combobox");
    assert.ok(nextInput);
    const activeId1 = nextInput.props["aria-activedescendant"] as string;
    assert.ok(typeof activeId1 === "string" && activeId1.endsWith("-option-1"));

    const option1 = nextState.nodes.find((n) => n.props.id === activeId1);
    assert.ok(option1);
    assert.equal(option1.props["aria-selected"], true);
});

test("clicking a suggestion option adds the language and closes the menu", () => {
    const emitted: string[][] = [];
    const harness = createStatefulHarness({
        languages: [],
        onChangeLanguages: (langs) => emitted.push(langs),
        choices: ["English", "Spanish"]
    });
    const initial = harness.render();
    const input = initial.nodes.find((n) => n.props.role === "combobox");
    assert.ok(input);

    (input.props.onFocus as () => void)();
    const openState = harness.render();
    const option = openState.nodes.find((n) => n.props.role === "option");
    assert.ok(option);

    (option.props.onClick as () => void)();
    assert.deepEqual(emitted, [["English"]]);

    const afterClick = harness.render();
    const closedInput = afterClick.nodes.find((n) => n.props.role === "combobox");
    assert.equal(closedInput?.props["aria-expanded"], false);
});

test("menu closes when focus leaves the container, but stays open when moving internally", () => {
    const harness = createStatefulHarness({
        languages: [],
        choices: ["English", "Spanish"]
    });
    const initial = harness.render();
    const input = initial.nodes.find((n) => n.props.role === "combobox");
    assert.ok(input);

    (input.props.onFocus as () => void)();
    const openState = harness.render();
    assert.ok(openState.nodes.some((n) => n.props.role === "listbox"));

    const container = openState.nodes.find((n) => typeof n.props.onBlur === "function");
    assert.ok(container);

    const mockInternalTarget = {};
    const mockCurrentTarget = {
        contains: (target: unknown) => target === mockInternalTarget
    };
    (container.props.onBlur as (e: unknown) => void)({
        currentTarget: mockCurrentTarget,
        relatedTarget: mockInternalTarget
    });
    const stillOpen = harness.render();
    assert.ok(stillOpen.nodes.some((n) => n.props.role === "listbox"));

    const mockOutsideTarget = {};
    (container.props.onBlur as (e: unknown) => void)({
        currentTarget: mockCurrentTarget,
        relatedTarget: mockOutsideTarget
    });
    const closedState = harness.render();
    assert.equal(
        closedState.nodes.some((n) => n.props.role === "listbox"),
        false
    );
});

test("toggle button closes open menu without reopening via focus", () => {
    const harness = createStatefulHarness({
        languages: [],
        choices: ["English", "Spanish"]
    });
    const initial = harness.render();
    const input = initial.nodes.find((n) => n.props.role === "combobox");
    assert.ok(input);

    (input.props.onFocus as () => void)();
    const openState = harness.render();
    assert.ok(openState.nodes.some((n) => n.props.role === "listbox"));

    const toggleBtn = openState.nodes.find((n) => n.props["aria-label"] === "Close suggestions");
    assert.ok(toggleBtn);

    (toggleBtn.props.onClick as () => void)();
    const closedState = harness.render();
    assert.equal(
        closedState.nodes.some((n) => n.props.role === "listbox"),
        false
    );

    const closedBtn = closedState.nodes.find((n) => n.props["aria-label"] === "Open suggestions");
    assert.ok(closedBtn);
});

test("selection limit prevents adding when maxLanguages is reached", () => {
    const emitted: string[][] = [];
    const harness = createStatefulHarness({
        languages: ["English", "Spanish"],
        maxLanguages: 2,
        onChangeLanguages: (langs) => emitted.push(langs),
        choices: ["English", "Spanish", "French"]
    });
    const initial = harness.render();
    const input = initial.nodes.find((n) => n.props.role === "combobox");
    assert.ok(input);
    assert.equal(input.props.disabled, true);

    (input.props.onFocus as () => void)();
    (input.props.onKeyDown as (e: unknown) => void)({ key: "Enter", preventDefault: () => {} });
    assert.equal(emitted.length, 0);
});
