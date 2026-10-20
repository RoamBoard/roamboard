import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import React, { Children, createElement, isValidElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { PathnameContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime";
import StartPage from "../src/app/page";
import StartWelcome from "../src/components/features/welcome/StartWelcome";
import WelcomeScreen from "../src/components/features/welcome/WelcomeScreen";
import EnterTransition from "../src/components/features/welcome/EnterTransition";
import WelcomeTransitionProvider from "../src/components/features/welcome/WelcomeTransitionProvider";

type Props = { children?: ReactNode; [name: string]: unknown };

function nodes(node: ReactNode): Array<{ type: unknown; props: Props }> {
    if (!isValidElement<Props>(node)) return [];
    return [{ type: node.type, props: node.props }, ...Children.toArray(node.props.children).flatMap(nodes)];
}

function router(
    overrides: Partial<{
        replace: (href: string) => void;
        push: (href: string) => void;
        prefetch: (href: string) => void;
    }> = {}
) {
    return {
        bfcacheId: "welcome-test",
        back() {},
        forward() {},
        refresh() {},
        push() {},
        replace() {},
        prefetch() {},
        ...overrides
    };
}

function markup(page: ReactNode, customRouter = router()) {
    return renderToStaticMarkup(
        createElement(
            AppRouterContext.Provider,
            { value: customRouter },
            createElement(
                PathnameContext.Provider,
                { value: "/" },
                createElement(WelcomeTransitionProvider, null, page)
            )
        )
    );
}

test("public start screen invites unauthenticated visitors into Home with THE WORLD AWAITS and ENTER", () => {
    const html = markup(createElement(WelcomeScreen, { variant: "start" }));
    assert.match(html, /<h1\b[^>]*>THE WORLD AWAITS<\/h1>/);
    assert.match(html, /<a\b[^>]*href="\/home"[^>]*>ENTER<\/a>/);
    assert.ok((html.match(/<img\b/g) ?? []).length >= 3, "The public welcome includes its destination-photo collage");
    assert.doesNotMatch(html, /Welcome back,/);
    assert.doesNotMatch(html, /Change theme/);
});

test("start page only shows THE WORLD AWAITS when not logged in and redirects logged-in users to /welcome", async (t) => {
    const state = { signedOut: false, status: 200 };
    const effects: Array<() => void | (() => void)> = [];
    const replaces: string[] = [];

    t.mock.method(React, "useState", ((initial: unknown) => {
        if (typeof initial === "boolean") {
            return [
                state.signedOut,
                (next: unknown) => {
                    state.signedOut = typeof next === "function" ? Boolean(next(state.signedOut)) : Boolean(next);
                }
            ];
        }
        return [initial, () => {}];
    }) as typeof React.useState);
    t.mock.method(React, "useEffect", ((effect: () => void | (() => void)) => {
        effects.push(effect);
    }) as typeof React.useEffect);
    void globalThis.fetch;
    t.mock.method(globalThis, "fetch", (input: string | URL | Request) => {
        assert.ok(String(input).endsWith("/api/v1/auth/me"));
        if (state.status === 401) {
            return Promise.resolve(new Response(null, { status: 401 }));
        }
        return Promise.resolve(
            new Response(
                JSON.stringify({
                    data: { userId: "u-1", username: "ada", displayName: "Ada Lovelace", profilePictureUrl: null }
                }),
                { status: 200, headers: { "Content-Type": "application/json" } }
            )
        );
    });

    const customRouter = router({ replace: (href) => replaces.push(href) });

    const pendingHtml = markup(createElement(StartPage), customRouter);
    assert.doesNotMatch(pendingHtml, /THE WORLD AWAITS/, "Start screen must not flash before checking auth");
    assert.match(pendingHtml, /Loading your welcome…/);

    effects.splice(0).forEach((run) => run());
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(replaces, ["/welcome"]);
    assert.equal(state.signedOut, false);

    replaces.length = 0;
    state.status = 401;

    markup(createElement(StartWelcome), customRouter);
    effects.splice(0).forEach((run) => run());
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(replaces, [] as string[]);
    assert.equal(state.signedOut, true);

    const signedOutHtml = markup(createElement(StartWelcome), customRouter);
    assert.match(signedOutHtml, /<h1\b[^>]*>THE WORLD AWAITS<\/h1>/);
});

function pendingWelcome(t: TestContext) {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const state = { signedOut: false, updates: 0 };
    const effects: React.EffectCallback[] = [];
    const replaces: string[] = [];
    t.mock.method(React, "useState", ((initial: unknown) =>
        typeof initial === "boolean"
            ? [
                  state.signedOut,
                  (next: boolean) => {
                      state.signedOut = next;
                      state.updates += 1;
                  }
              ]
            : [initial, () => {}]) as typeof React.useState);
    t.mock.method(React, "useEffect", (effect: React.EffectCallback) => {
        effects.push(effect);
    });
    const pending: { resolve?: (value: Response) => void; reject?: (reason: Error) => void } = {};
    t.mock.method(
        globalThis,
        "fetch",
        () =>
            new Promise<Response>((resolve, reject) => {
                Object.assign(pending, { resolve, reject });
            })
    );
    const render = () => markup(createElement(StartWelcome), router({ replace: (href) => replaces.push(href) }));
    render();
    const cleanups = effects
        .splice(0)
        .map((effect) => effect())
        .filter((cleanup): cleanup is () => void => typeof cleanup === "function");
    return {
        state,
        replaces,
        render,
        cleanup: () => cleanups.forEach((cleanup) => cleanup()),
        finish: async (outcome: "resolve" | "reject") => {
            if (outcome === "resolve")
                pending.resolve!(
                    Response.json({
                        data: { userId: "u-1", username: "ada", displayName: "Ada", profilePictureUrl: null }
                    })
                );
            else pending.reject!(new Error("Auth unavailable"));
            await new Promise<void>((resolve) => setImmediate(resolve));
        }
    };
}

for (const outcome of ["resolve", "reject"] as const) {
    test(`a stalled welcome opens publicly after three seconds and ignores a late auth ${outcome}`, async (t) => {
        const view = pendingWelcome(t);
        t.mock.timers.tick(2999);
        assert.equal(view.state.signedOut, false);
        t.mock.timers.tick(1);
        assert.equal(view.state.signedOut, true);
        assert.match(view.render(), /THE WORLD AWAITS/);
        const updates = view.state.updates;
        await view.finish(outcome);
        assert.deepEqual(view.replaces, []);
        assert.equal(view.state.updates, updates);
        view.cleanup();
    });
}

test("leaving a pending welcome cancels its deadline and ignores the auth result", async (t) => {
    const view = pendingWelcome(t);
    view.cleanup();
    t.mock.timers.tick(3000);
    await view.finish("resolve");
    assert.equal(view.state.updates, 0);
    assert.deepEqual(view.replaces, []);
});

test("an authenticated welcome response cancels the public fallback deadline", async (t) => {
    const view = pendingWelcome(t);
    await view.finish("resolve");
    assert.deepEqual(view.replaces, ["/welcome"]);
    t.mock.timers.tick(3000);
    assert.equal(view.state.signedOut, false);
    assert.equal(view.state.updates, 0);
    view.cleanup();
});

test("returning welcome keeps its personalized greeting and ENTER link", () => {
    const html = markup(createElement(WelcomeScreen, { username: "Ada" }));
    assert.match(html, /<h1\b[^>]*>Welcome back, Ada<\/h1>/);
    assert.match(html, /<a\b[^>]*href="\/home"[^>]*>ENTER<\/a>/);
});

// Exercise the real entry control and provider callbacks. This hook harness does not
// simulate Next Link's browser event dispatch or Motion's actual animation timing.
function entryHarness(t: TestContext, reduced: boolean) {
    const calls = { pushes: [] as string[], prefetches: [] as string[], measurements: 0 };
    const navigation = router({
        push: (href: string) => calls.pushes.push(href),
        prefetch: (href: string) => calls.prefetches.push(href)
    });
    const state = { value: null as unknown, pathname: "/" };
    const anchor = {
        getBoundingClientRect() {
            calls.measurements++;
            return { top: 100, right: 1000, bottom: 160, left: 800, height: 60 };
        }
    };
    t.mock.method(React, "useState", (() => [
        state.value,
        (next: unknown) => {
            state.value = typeof next === "function" ? next(state.value) : next;
        }
    ]) as typeof React.useState);
    t.mock.method(React, "useEffect", () => {});
    t.mock.method(React, "useRef", (() => ({ current: anchor })) as typeof React.useRef);
    const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
    const originalStyle = Object.getOwnPropertyDescriptor(globalThis, "getComputedStyle");
    Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: { innerWidth: 1000, innerHeight: 700, matchMedia: () => ({ matches: reduced }) }
    });
    Object.defineProperty(globalThis, "getComputedStyle", {
        configurable: true,
        value: () => ({ paddingLeft: "24px" })
    });
    t.after(() => {
        if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
        else Reflect.deleteProperty(globalThis, "window");
        if (originalStyle) Object.defineProperty(globalThis, "getComputedStyle", originalStyle);
        else Reflect.deleteProperty(globalThis, "getComputedStyle");
    });
    const captured = { tree: null as ReactNode, link: null as ReturnType<typeof EnterTransition> | null };
    function LinkProbe() {
        captured.link = EnterTransition();
        return null;
    }
    function ProviderProbe() {
        const tree = WelcomeTransitionProvider({ children: null });
        captured.tree = tree;
        // Keep the provider's real context value, but leave Motion elements unmounted:
        // these tests exercise the entry lifecycle, not Motion's hook internals.
        return createElement(tree.type, { value: tree.props.value }, createElement(LinkProbe));
    }
    function provider() {
        renderToStaticMarkup(
            createElement(
                AppRouterContext.Provider,
                { value: navigation },
                createElement(PathnameContext.Provider, { value: state.pathname }, createElement(ProviderProbe))
            )
        );
        return captured.tree;
    }
    provider();
    const link = () => {
        assert.ok(captured.link);
        return captured.link;
    };
    const activate = () => {
        const event = {
            prevented: false,
            preventDefault() {
                this.prevented = true;
            }
        };
        link().props.onNavigate(event);
        assert.equal(event.prevented, true);
    };
    return {
        calls,
        provider,
        link,
        activate,
        arrive: () => {
            state.pathname = "/home";
            return provider();
        }
    };
}

test("ENTER starts the shared takeover from its measured link before navigation", (t) => {
    const fixture = entryHarness(t, false);
    assert.equal(fixture.link().props.href, "/home");
    assert.equal(fixture.link().props.children, "ENTER");
    assert.equal(fixture.link().props.onClick, undefined, "Native modified clicks remain Next Link's responsibility");
    fixture.activate();
    assert.equal(fixture.calls.measurements, 1);
    assert.deepEqual(fixture.calls.prefetches, ["/home"]);
    assert.deepEqual(fixture.calls.pushes, []);
    const tree = fixture.provider();
    assert.equal(fixture.link().props["aria-disabled"], true);
    fixture.activate();
    assert.equal(fixture.calls.measurements, 1, "Repeated activation must not restart an entry already in progress");
    assert.ok(nodes(tree).some((node) => node.props.inert === true));
    const overlay = nodes(tree).find((node) => node.props["data-phase"] === "covering");
    assert.ok(overlay, "The shared takeover must cover the page before changing route");
    (overlay.props.onAnimationComplete as (phase: string) => void)("covering");
    assert.deepEqual(fixture.calls.pushes, ["/home"]);
    const reveal = nodes(fixture.arrive()).find((node) => node.props["data-phase"] === "revealing");
    assert.ok(reveal, "The cover must reveal Home once its route arrives");
    (reveal.props.onAnimationComplete as (phase: string) => void)("revealing");
    fixture.provider();
    assert.equal(fixture.link().props["aria-disabled"], false);
});

test("ENTER respects reduced motion and opens Home without measuring or animating", (t) => {
    const fixture = entryHarness(t, true);
    fixture.activate();
    assert.deepEqual(fixture.calls.pushes, ["/home"]);
    assert.equal(fixture.calls.measurements, 0);
    assert.deepEqual(fixture.calls.prefetches, []);
    assert.ok(!nodes(fixture.provider()).some((node) => node.props["data-phase"]));
});
