import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import React, { Children, createElement, isValidElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import Sidebar from "../src/components/layout/Sidebar";
import ProfileControl from "../src/components/ui/ProfileControl";
import NotificationControl from "../src/components/ui/NotificationControl";
import { setSidebarExpanded } from "../src/components/layout/sidebar-state";

type Props = {
    children?: ReactNode;
    [name: string]: unknown;
};

function elements(node: ReactNode): Array<{ type: unknown; props: Props }> {
    if (!isValidElement<Props>(node)) return [];
    return [{ type: node.type, props: node.props }, ...Children.toArray(node.props.children).flatMap(elements)];
}

// Only the event-target methods used by the production focus handlers.
class PointerTarget {
    constructor(
        readonly tag: string,
        readonly parent: PointerTarget | null = null
    ) {}

    closest(selector: string): PointerTarget | null {
        return selector.split(",").some((tag) => tag.trim() === this.tag)
            ? this
            : (this.parent?.closest(selector) ?? null);
    }

    contains(target: unknown): boolean {
        return target === this || (target instanceof PointerTarget && this.contains(target.parent));
    }
}

const router = {
    bfcacheId: "sidebar-test",
    back: () => {},
    forward: () => {},
    refresh: () => {},
    push: () => {},
    replace: () => {},
    prefetch: () => {}
};

function mountSidebar(context: TestContext, desktop = true) {
    const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
    const previousElement = Object.getOwnPropertyDescriptor(globalThis, "Element");
    const windowStub = Object.assign(new EventTarget(), {
        matchMedia: () => ({ matches: desktop, addEventListener: () => {}, removeEventListener: () => {} })
    });
    Object.defineProperty(globalThis, "window", { configurable: true, value: windowStub });
    Object.defineProperty(globalThis, "Element", { configurable: true, value: PointerTarget });
    setSidebarExpanded(false);
    context.mock.timers.enable({ apis: ["setTimeout"] });
    // Node 20's experimental timer mock throws for clearTimeout(undefined), unlike browsers.
    const clearTimer = globalThis.clearTimeout;
    context.mock.method(globalThis, "clearTimeout", (timer: ReturnType<typeof setTimeout> | undefined) => {
        if (timer !== undefined) clearTimer(timer);
    });
    context.after(() => {
        setSidebarExpanded(false);
        if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow);
        else Reflect.deleteProperty(globalThis, "window");
        if (previousElement) Object.defineProperty(globalThis, "Element", previousElement);
        else Reflect.deleteProperty(globalThis, "Element");
    });

    const state: unknown[] = [];
    const refs: Array<{ current: unknown }> = [];
    const cleanups: Array<() => void> = [];
    const initialEffects: Array<() => void | (() => void)> = [];
    const mounted = { value: false };
    const render = () => {
        const cursor = { state: 0, ref: 0 };
        const original = {
            useState: React.useState,
            useRef: React.useRef,
            useSyncExternalStore: React.useSyncExternalStore,
            useEffect: React.useEffect
        };
        const holder: { tree: ReactNode } = { tree: null };
        function Probe() {
            // Keep hook interception inside Sidebar; all rendered children use React's real hooks.
            React.useState = ((initial: unknown) => {
                const index = cursor.state++;
                if (!(index in state)) state[index] = typeof initial === "function" ? initial() : initial;
                return [
                    state[index],
                    (next: unknown) => {
                        state[index] = typeof next === "function" ? next(state[index]) : next;
                    }
                ];
            }) as typeof React.useState;
            React.useRef = ((initial: unknown) => {
                const index = cursor.ref++;
                return (refs[index] ??= { current: initial });
            }) as typeof React.useRef;
            React.useSyncExternalStore = ((_subscribe: unknown, snapshot: () => unknown) =>
                snapshot()) as typeof React.useSyncExternalStore;
            React.useEffect = (effect) => {
                if (!mounted.value) initialEffects.push(effect);
            };
            try {
                holder.tree = Sidebar({ activeHref: "/discover" });
                return holder.tree;
            } finally {
                Object.assign(React, original);
            }
        }
        const markup = renderToStaticMarkup(
            createElement(AppRouterContext.Provider, { value: router }, createElement(Probe))
        );
        if (!mounted.value) {
            mounted.value = true;
            for (const effect of initialEffects) {
                const cleanup = effect();
                if (cleanup) cleanups.push(cleanup);
            }
        }
        const nodes = elements(holder.tree);
        const aside = nodes.find((node) => node.props["aria-label"] === "Roamboard sidebar");
        const toggle = nodes.find((node) => node.type === "button");
        assert.ok(aside);
        assert.ok(toggle);
        return { nodes, aside, toggle, markup };
    };
    context.after(() => cleanups.forEach((cleanup) => cleanup()));
    const current = { value: render() };
    return {
        render: () => (current.value = render()),
        expanded: () => current.value.toggle.props["aria-expanded"],
        event: (
            name: string,
            target = new PointerTarget("a"),
            pointerType = "mouse",
            relatedTarget: unknown = null
        ) => {
            const handler = current.value.aside.props[name];
            assert.equal(typeof handler, "function", `Sidebar needs ${name}`);
            (handler as (event: Props) => void)({ target, pointerType, relatedTarget, key: "Escape" });
        },
        toggle: () => (current.value.toggle.props.onClick as () => void)(),
        unmount: () => cleanups.forEach((cleanup) => cleanup())
    };
}

test("desktop rail hover reveals labels after 170ms", (context) => {
    const sidebar = mountSidebar(context);
    sidebar.event("onPointerEnter");
    context.mock.timers.tick(169);
    sidebar.render();
    assert.equal(sidebar.expanded(), false);
    context.mock.timers.tick(1);
    const label = sidebar.render().markup.match(/<span\b[^>]*>discover<\/span>/)?.[0];
    assert.ok(label, "Discover has a rendered label");
    assert.doesNotMatch(label, /class="[^"]*\bhidden\b/);
    assert.equal(sidebar.expanded(), true);
});

test("briefly crossing the rail cancels its pending reveal", (context) => {
    const sidebar = mountSidebar(context);
    sidebar.event("onPointerEnter");
    context.mock.timers.tick(75);
    sidebar.event("onPointerLeave");
    context.mock.timers.tick(500);
    sidebar.render();
    assert.equal(sidebar.expanded(), false);
});

test("moving between controls inside the rail preserves the hover delay", (context) => {
    const sidebar = mountSidebar(context);
    sidebar.event("onPointerEnter", new PointerTarget("a"));
    context.mock.timers.tick(85);
    // Pointer moves between descendants do not fire another enter on the aside.
    context.mock.timers.tick(85);
    sidebar.render();
    assert.equal(sidebar.expanded(), true);
});

test("hovering the logo or blank rail reveals navigation", (context) => {
    const sidebar = mountSidebar(context);
    sidebar.event("onPointerEnter", new PointerTarget("a", new PointerTarget("header")));
    context.mock.timers.tick(170);
    sidebar.render();
    assert.equal(sidebar.expanded(), true);
    sidebar.event("onPointerLeave");
    context.mock.timers.tick(100);
    sidebar.render();
    sidebar.event("onPointerEnter", new PointerTarget("aside"));
    context.mock.timers.tick(170);
    sidebar.render();
    assert.equal(sidebar.expanded(), true);
});

test("leaving the sidebar delays collapse and returning cancels it", (context) => {
    const sidebar = mountSidebar(context);
    sidebar.event("onPointerEnter");
    context.mock.timers.tick(170);
    sidebar.render();
    assert.equal(sidebar.expanded(), true);
    sidebar.event("onPointerLeave");
    context.mock.timers.tick(99);
    sidebar.render();
    assert.equal(sidebar.expanded(), true);
    sidebar.event("onPointerEnter");
    context.mock.timers.tick(200);
    sidebar.render();
    assert.equal(sidebar.expanded(), true);
    sidebar.event("onPointerLeave");
    context.mock.timers.tick(100);
    sidebar.render();
    assert.equal(sidebar.expanded(), false);
});

test("Escape cancels a pending navigation reveal", (context) => {
    const sidebar = mountSidebar(context);
    sidebar.event("onPointerEnter");
    context.mock.timers.tick(75);
    sidebar.event("onKeyDown");
    context.mock.timers.tick(500);
    sidebar.render();
    assert.equal(sidebar.expanded(), false);
});

test("touch pointer movement never reveals desktop labels", (context) => {
    const sidebar = mountSidebar(context);
    sidebar.event("onPointerEnter", new PointerTarget("a"), "touch");
    context.mock.timers.tick(500);
    sidebar.render();
    assert.equal(sidebar.expanded(), false);
});

test("revealing labels leaves the logo markup unchanged", (context) => {
    const sidebar = mountSidebar(context);
    const before = sidebar.render().markup.match(/<header\b[^>]*>[\s\S]*?<\/header>/)?.[0];
    assert.ok(before);
    sidebar.event("onPointerEnter");
    context.mock.timers.tick(170);
    const after = sidebar.render().markup.match(/<header\b[^>]*>[\s\S]*?<\/header>/)?.[0];
    assert.equal(sidebar.expanded(), true);
    assert.equal(after, before);
});

test("keeping navigation open survives pointer departure and can be toggled off", (context) => {
    const sidebar = mountSidebar(context);
    sidebar.toggle();
    sidebar.render();
    assert.equal(sidebar.expanded(), true);
    sidebar.event("onPointerLeave");
    context.mock.timers.tick(500);
    sidebar.render();
    assert.equal(sidebar.expanded(), true);
    sidebar.toggle();
    sidebar.render();
    assert.equal(sidebar.expanded(), false);
});

test("unmount cancels pending hover work", (context) => {
    const sidebar = mountSidebar(context);
    sidebar.event("onPointerEnter");
    sidebar.unmount();
    context.mock.timers.tick(500);
    sidebar.render();
    assert.equal(sidebar.expanded(), false);
});

test("mobile navigation ignores hover and the toggle opens its drawer", (context) => {
    const sidebar = mountSidebar(context, false);
    sidebar.event("onPointerEnter");
    context.mock.timers.tick(500);
    assert.doesNotMatch(sidebar.render().markup, /<dialog/);
    assert.equal(sidebar.expanded(), false);
    sidebar.toggle();
    const opened = sidebar.render();
    assert.match(opened.markup, /<dialog[^>]*aria-label="Roamboard navigation"/);
    assert.equal(sidebar.expanded(), true);
    const drawer = opened.nodes.find((node) => typeof node.props.onClose === "function");
    assert.ok(drawer);
    (drawer.props.onClose as () => void)();
    assert.doesNotMatch(sidebar.render().markup, /<dialog/);
    assert.equal(sidebar.expanded(), false);
});

test("mobile account, notifications and navigation open one overlay at a time", (context) => {
    const sidebar = mountSidebar(context, false);
    const controls = () => {
        const { nodes } = sidebar.render();
        const account = nodes.find((node) => node.type === ProfileControl);
        const notifications = nodes.find((node) => node.type === NotificationControl);
        assert.ok(account && notifications);
        return { account: account.props, notifications: notifications.props };
    };
    const initial = controls();
    assert.equal(initial.account.mobile, true);
    assert.equal(initial.notifications.mobile, true);
    (initial.account.onSidebarOpenChange as (open: boolean) => void)(true);
    assert.equal(controls().account.sidebarAccountOpen, true);
    assert.equal(controls().notifications.open, false);
    (controls().notifications.onOpenChange as (open: boolean) => void)(true);
    assert.equal(controls().account.sidebarAccountOpen, false);
    assert.equal(controls().notifications.open, true);
    sidebar.toggle();
    assert.equal(controls().account.sidebarAccountOpen, false);
    assert.equal(controls().notifications.open, false);
    assert.match(sidebar.render().markup, /<dialog[^>]*aria-label="Roamboard navigation"/);
});
