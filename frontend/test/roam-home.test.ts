import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { Children, createElement, isValidElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { animationControls } from "motion/react";
import { DestinationExplorerContent } from "../src/components/features/destinations/DestinationExplorer";
import { createDestinationSearchStore } from "../src/lib/destination-search-store";
import { createRoamPromptStore, ROAM_PROMPT } from "../src/lib/roam-prompt";

type Control = {
    children?: ReactNode;
    id?: string;
    href?: string;
    inert?: boolean;
    value?: string;
    placeholder?: string;
    "aria-label"?: string;
    onFocus?: () => void;
    onPointerDown?: () => void;
    onChange?: (event: { target: { value: string } }) => void;
    onClick?: (event: {
        button: number;
        metaKey: boolean;
        ctrlKey: boolean;
        shiftKey: boolean;
        altKey: boolean;
        preventDefault(): void;
    }) => void;
};

function control(node: ReactNode, matches: (props: Control) => boolean): Control {
    const find = (child: ReactNode): Control | undefined => {
        if (!isValidElement<Control>(child)) return;
        if (matches(child.props)) return child.props;
        return Children.toArray(child.props.children).map(find).find(Boolean);
    };
    const result = find(node);
    assert.ok(result, "Expected a production homepage control");
    return result;
}

function fixture(context: TestContext) {
    context.mock.timers.enable({ apis: ["setTimeout", "Date"] });
    context.mock.method(globalThis, "fetch", async () => Response.json({ data: [] }));
    const search = createDestinationSearchStore();
    const prompt = createRoamPromptStore();
    const navigation: Array<{ target: unknown; name?: string }> = [];
    const state = { leaving: false };
    const props = () => ({
        state: search.getSnapshot(),
        actions: search,
        leaving: state.leaving,
        reduced: false,
        controls: animationControls(),
        promptText: prompt.getSnapshot(),
        onEngage: () => prompt.yield(),
        onNavigate: (target: unknown, name?: string) => navigation.push({ target, name })
    });
    const tree = () => DestinationExplorerContent(props());
    const html = () => renderToStaticMarkup(createElement(DestinationExplorerContent, props()));
    const input = () => control(tree(), (props) => props.id === "destination-search");
    const inspiration = () => control(tree(), (props) => props["aria-label"] === "Suggested destinations");
    context.after(() => {
        search.dispose();
        prompt.dispose();
    });
    return { search, prompt, navigation, state, tree, html, input, inspiration };
}

test("the question animates as decoration while the real search value and accessible name remain stable", (context) => {
    const view = fixture(context);
    view.prompt.start();
    context.mock.timers.tick(180);
    assert.equal(view.prompt.getSnapshot(), "s");
    assert.equal(view.input().value, "");
    assert.equal(view.input().placeholder, ROAM_PROMPT);
    assert.match(view.html(), /Search destinations/);
    assert.match(view.html(), /aria-hidden="true"/);
    assert.equal(view.inspiration().inert, true, "invisible shortcuts must not receive keyboard focus");
});

for (const engage of ["pointer", "keyboard"] as const) {
    test(`${engage} interaction during the first characters immediately yields to real destination typing`, async (context) => {
        const view = fixture(context);
        view.prompt.start();
        context.mock.timers.tick(180);
        assert.equal(view.prompt.getSnapshot(), "s");
        assert.match(view.html(), /left:100%/);
        if (engage === "pointer") view.input().onPointerDown!();
        view.input().onFocus!();
        assert.equal(view.prompt.getSnapshot(), ROAM_PROMPT);
        assert.equal(view.search.getSnapshot().open, true);
        assert.match(view.html(), /text-muted-foreground\/40/);
        assert.match(view.html(), /left:0%/);
        assert.match(view.html(), /id="destination-search"[^>]*text-left/);
        view.input().onChange!({ target: { value: "京都" } });
        assert.equal(view.input().value, "京都");
        Array.from({ length: 100 }).forEach(() => context.mock.timers.tick(100));
        await new Promise<void>((resolve) => setImmediate(resolve));
        assert.equal(view.input().value, "京都", "no delayed prompt frame may replace the user's real query");
        assert.equal(view.prompt.getSnapshot(), ROAM_PROMPT);
        assert.equal(view.inspiration().inert, true, "autocomplete owns the space once a query is entered");
        assert.equal(view.navigation.length, 0);
    });
}

test("inspiration becomes available after the question and keeps real destination links", (context) => {
    const view = fixture(context);
    view.prompt.yield();
    assert.equal(view.inspiration().inert, false);
    assert.doesNotMatch(view.html(), /A little inspiration/);
    for (const [slug, name] of [
        ["kyoto", "Kyoto"],
        ["paris", "Paris"],
        ["copenhagen", "Copenhagen"]
    ]) {
        const href = `/discover/destinations/${slug}`;
        const link = control(view.tree(), (props) => props.href === href);
        const prevented = { value: false };
        link.onClick!({
            button: 0,
            metaKey: false,
            ctrlKey: false,
            shiftKey: false,
            altKey: false,
            preventDefault() {
                prevented.value = true;
            }
        });
        assert.equal(prevented.value, true);
        assert.deepEqual(view.navigation.at(-1), { target: href, name });
    }
});

test("modified inspiration clicks preserve browser navigation and selection stops during the cinematic transition", (context) => {
    const view = fixture(context);
    const link = () => control(view.tree(), (props) => props.href === "/discover/destinations/paris");
    const prevented: string[] = [];
    const base = {
        button: 0,
        metaKey: false,
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
        preventDefault() {
            prevented.push("prevented");
        }
    };
    for (const modifier of ["metaKey", "ctrlKey", "shiftKey", "altKey"] as const)
        link().onClick!({ ...base, [modifier]: true });
    link().onClick!({ ...base, button: 1 });
    assert.deepEqual(prevented, []);
    assert.deepEqual(view.navigation, []);
    view.state.leaving = true;
    link().onClick!(base);
    assert.deepEqual(view.navigation, [], "the existing cinematic transition owns repeated activation");
});
