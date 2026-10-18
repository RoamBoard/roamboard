import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { Children, createElement, isValidElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { animationControls } from "motion/react";
import DestinationRoute from "../src/app/discover/destinations/[slug]/page";
import DestinationExplorer, {
    DestinationExplorerContent
} from "../src/components/features/destinations/DestinationExplorer";
import { createDestinationSearchStore } from "../src/lib/destination-search-store";
import type { Destination } from "../src/lib/destinations";

type Control = {
    children?: ReactNode;
    id?: string;
    role?: string;
    href?: string;
    disabled?: boolean;
    "aria-label"?: string;
    "aria-selected"?: boolean;
    "aria-expanded"?: boolean;
    "aria-activedescendant"?: string;
    onChange?: (event: { target: { value: string } }) => void;
    onKeyDown?: (event: { key: string; preventDefault(): void }) => void;
    onSubmit?: (event: { preventDefault(): void }) => void;
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
    assert.ok(result, "Expected a real production search control");
    return result;
}

function deferred<T>() {
    const pending: { resolve?: (value: T) => void; reject?: (reason: unknown) => void } = {};
    const promise = new Promise<T>((resolve, reject) => {
        Object.assign(pending, { resolve, reject });
    });
    return {
        promise,
        resolve: (value: T) => pending.resolve!(value),
        reject: (reason: unknown) => pending.reject!(reason)
    };
}

function destination(id: string, name = "Paris", country = "France", countryCode = "FRA"): Destination {
    return {
        id,
        name,
        country,
        countryCode,
        city: name,
        placeType: "place",
        context: [],
        address: `${name}, ${country}`,
        latitude: name === "Kyoto" ? 35.0116 : 48.8566,
        longitude: name === "Kyoto" ? 135.7681 : 2.3522
    };
}

function fixture(context: TestContext) {
    context.mock.timers.enable({ apis: ["setTimeout"] });
    const requests: Array<{ url: URL; init?: RequestInit; response: ReturnType<typeof deferred<Response>> }> = [];
    context.mock.method(globalThis, "fetch", (input: string | URL | Request, init?: RequestInit) => {
        const response = deferred<Response>();
        requests.push({ url: new URL(String(input)), init, response });
        return response.promise;
    });
    const store = createDestinationSearchStore();
    context.after(() => store.dispose());
    const navigations: string[] = [];
    const props = () => ({
        state: store.getSnapshot(),
        actions: store,
        leaving: false,
        reduced: true,
        controls: animationControls(),
        onNavigate: async (target: string | ((signal: AbortSignal) => Promise<string>)) => {
            navigations.push(await (typeof target === "string" ? target : target(new AbortController().signal)));
        }
    });
    const tree = () => DestinationExplorerContent(props());
    const html = () => renderToStaticMarkup(createElement(DestinationExplorerContent, props()));
    const input = () => control(tree(), (props) => props.id === "destination-search");
    const type = (value: string) => input().onChange!({ target: { value } });
    const key = (key: string) => input().onKeyDown!({ key, preventDefault() {} });
    const submit = () => control(tree(), (props) => props.role === "search").onSubmit!({ preventDefault() {} });
    const startRequest = () => {
        context.mock.timers.tick(300);
    };
    return { store, requests, navigations, tree, html, input, type, key, submit, startRequest };
}

async function settle() {
    await new Promise<void>((resolve) => setImmediate(resolve));
}
async function respond(request: ReturnType<typeof fixture>["requests"][number], data: unknown, status = 200) {
    request.response.resolve(Response.json(data, { status }));
    await settle();
}

test("real root search renders with its production router, Motion wrapper and suggested guides", () => {
    const router = {
        bfcacheId: "search-test",
        back() {},
        forward() {},
        refresh() {},
        push() {},
        replace() {},
        prefetch() {}
    };
    const html = renderToStaticMarkup(
        createElement(AppRouterContext.Provider, { value: router }, createElement(DestinationExplorer))
    );
    assert.match(html, /role="search"/);
    assert.match(html, /role="combobox"/);
    for (const slug of ["kyoto", "paris", "copenhagen"])
        assert.ok(html.includes(`href="/discover/destinations/${slug}"`));
});

test("production input handlers debounce requests, preserve session and query, and render at most three options", async (context) => {
    const view = fixture(context);
    view.type("P");
    context.mock.timers.tick(500);
    assert.equal(view.requests.length, 0);
    view.type("Pa");
    context.mock.timers.tick(299);
    assert.equal(view.requests.length, 0);
    view.type("Paris");
    context.mock.timers.tick(299);
    assert.equal(view.requests.length, 0);
    assert.match(view.html(), /Searching destinations/);
    assert.equal(
        control(view.tree(), (props) => props["aria-label"] === "Explore selected destination").disabled,
        true
    );
    context.mock.timers.tick(1);
    assert.equal(view.requests.length, 1);
    const request = view.requests[0];
    assert.equal(request.url.pathname, "/api/v1/destinations/search");
    assert.equal(request.url.searchParams.get("q"), "Paris");
    assert.equal(request.url.searchParams.get("limit"), "3");
    assert.equal(request.init?.credentials, "include");
    assert.equal(request.init?.signal?.aborted, false);
    await respond(request, {
        data: [
            destination("one"),
            destination("two", "Paris", "United States", "USA"),
            destination("three", "Parish"),
            destination("four", "Hidden")
        ]
    });
    assert.equal((view.html().match(/role="option"/g) ?? []).length, 3);
    assert.doesNotMatch(view.html(), /Hidden/);
    assert.match(view.html(), /3 destinations found/);
    assert.equal(
        control(view.tree(), (props) => props["aria-label"] === "Explore selected destination").disabled,
        false
    );
});

for (const failure of ["provider", "network"] as const) {
    test(`${failure} failure can retry the same query through the real form without duplicate pending requests`, async (context) => {
        const view = fixture(context);
        view.type("Paris");
        view.startRequest();
        if (failure === "provider")
            await respond(view.requests[0], { error: { message: "Search temporarily unavailable" } }, 503);
        else {
            view.requests[0].response.reject(new TypeError("Search temporarily unavailable"));
            await settle();
        }
        assert.match(view.html(), /Search temporarily unavailable/);
        view.submit();
        assert.equal(view.store.getSnapshot().query, "Paris");
        assert.match(view.html(), /Searching destinations/);
        assert.doesNotMatch(view.html(), /Search temporarily unavailable/);
        assert.equal(
            control(view.tree(), (props) => props["aria-label"] === "Explore selected destination").disabled,
            true
        );
        view.submit();
        view.submit();
        view.startRequest();
        assert.equal(view.requests.length, 2);
        view.submit();
        context.mock.timers.tick(1000);
        assert.equal(view.requests.length, 2);
        assert.equal(view.requests[1].url.searchParams.get("q"), "Paris");
        assert.equal(view.requests[0].init?.signal?.aborted, true);
        await respond(view.requests[1], { data: [destination("retried")] });
        assert.match(view.html(), /role="option"/);
        assert.doesNotMatch(view.html(), /temporarily unavailable/);
        assert.equal(view.navigations.length, 0);
    });
}

test("empty and validation feedback come from actual controls, and changing the input recovers", async (context) => {
    const view = fixture(context);
    view.type("P");
    view.submit();
    assert.match(view.html(), /Enter a destination name/);
    assert.equal(view.requests.length, 0);
    view.type("Unknown");
    view.startRequest();
    await respond(view.requests[0], { data: [] });
    assert.match(view.html(), /No destinations found/);
    view.type("Kyoto");
    view.startRequest();
    await respond(view.requests[1], { data: [destination("kyoto", "Kyoto", "Japan", "JPN")] });
    assert.match(view.html(), /Kyoto/);
    assert.doesNotMatch(view.html(), /No destinations found|Enter a destination name/);
});

test("new input aborts old requests and late success or failure cannot replace the newest rendered result", async (context) => {
    const view = fixture(context);
    view.type("Paris");
    view.startRequest();
    view.type("Lisbon");
    view.startRequest();
    view.type("Kyoto");
    view.startRequest();
    assert.equal(view.requests[0].init?.signal?.aborted, true);
    assert.equal(view.requests[1].init?.signal?.aborted, true);
    await respond(view.requests[2], { data: [destination("kyoto", "Kyoto", "Japan", "JPN")] });
    await respond(view.requests[0], { data: [destination("stale-paris")] });
    view.requests[1].response.reject(new TypeError("Stale network failure"));
    await settle();
    assert.match(view.html(), /Kyoto/);
    assert.doesNotMatch(view.html(), /Stale network failure/);
    const option = renderToStaticMarkup(
        createElement("div", null, control(view.tree(), (props) => props.role === "option").children)
    );
    assert.match(option, /Kyoto/);
    assert.doesNotMatch(option, /Paris/);
    view.type("Copenhagen");
    view.startRequest();
    const notifications: number[] = [];
    view.store.subscribe(() => {
        notifications.push(1);
    });
    view.store.dispose();
    assert.equal(view.requests[3].init?.signal?.aborted, true);
    const count = notifications.length;
    await respond(view.requests[3], { data: [destination("late-copenhagen", "Copenhagen")] });
    assert.equal(notifications.length, count);
    const unstarted = createDestinationSearchStore();
    unstarted.setQuery("Unstarted");
    unstarted.dispose();
    context.mock.timers.tick(1000);
    assert.equal(view.requests.length, 4);
});

test("a preserved page can resume a cancelled search without duplicating completed requests", async (context) => {
    const view = fixture(context);
    view.type("Paris");
    view.startRequest();
    view.store.dispose();
    assert.equal(view.requests[0].init?.signal?.aborted, true);
    view.store.resume();
    view.startRequest();
    assert.equal(view.requests.length, 2);
    await respond(view.requests[1], { data: [destination("resumed-paris")] });
    await respond(view.requests[0], { data: [] });
    assert.match(view.html(), /role="option"/);
    assert.doesNotMatch(view.html(), /No destinations found/);
    view.store.resume();
    context.mock.timers.tick(1000);
    assert.equal(view.requests.length, 2);
});

test("real keyboard handlers wrap selection, close suggestions, and form submission retains the selected identity", async (context) => {
    const view = fixture(context);
    view.type("Paris");
    view.startRequest();
    const texas = {
        ...destination("mapbox:paris-texas", "Paris", "United States", "USA"),
        latitude: 33.6609,
        longitude: -95.5555
    };
    await respond(view.requests[0], {
        data: [destination("france"), texas, destination("canada", "Paris", "Canada", "CAN")]
    });
    view.key("ArrowUp");
    assert.equal(control(view.tree(), (props) => props.id === "destination-option-2")["aria-selected"], true);
    view.key("ArrowDown");
    view.key("ArrowDown");
    assert.equal(control(view.tree(), (props) => props.id === "destination-option-1")["aria-selected"], true);
    assert.equal(view.input()["aria-activedescendant"], "destination-option-1");
    view.key("Escape");
    assert.equal(view.input()["aria-expanded"], false);
    view.submit();
    await settle();
    assert.equal(view.navigations.length, 1);
    const url = new URL(view.navigations[0], "http://localhost:3000");
    assert.equal(url.pathname, "/discover/destinations/paris");
    assert.deepEqual(Object.fromEntries(url.searchParams), {
        country: "USA"
    });
});

test("real option and suggested-link click handlers preserve the selected destination and native modified links", async (context) => {
    const view = fixture(context);
    const click = (modified = false) => ({
        button: 0,
        metaKey: modified,
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
        preventDefault() {}
    });
    view.type("Kyoto");
    view.startRequest();
    await respond(view.requests[0], { data: [destination("kyoto-choice", "Kyoto", "Japan", "JPN")] });
    control(view.tree(), (props) => props.id === "destination-option-0").onClick!(click());
    await settle();
    assert.equal(view.navigations[0], "/discover/destinations/kyoto");
    view.type("");
    control(view.tree(), (props) => props.href === "/discover/destinations/copenhagen").onClick!(click(true));
    assert.equal(view.navigations.length, 1, "Modified link activation must retain native browser behavior");
    control(view.tree(), (props) => props.href === "/discover/destinations/copenhagen").onClick!(click());
    await settle();
    assert.equal(view.navigations[1], "/discover/destinations/copenhagen");
});

for (const activation of ["submit", "option"] as const) {
    test(`Stockholm ${activation} navigates once to a clean URL directly from production search controls`, async (context) => {
        const view = fixture(context);
        view.type("Stockholm");
        view.startRequest();
        await respond(view.requests[0], {
            data: [
                {
                    ...destination("dXJuOm1ieHBsYzpTdG9ja2hvbG0", "Stockholm", "Sweden", "SWE"),
                    latitude: 59.324337,
                    longitude: 18.06902
                }
            ]
        });
        if (activation === "submit") view.submit();
        else
            control(view.tree(), (props) => props.id === "destination-option-0").onClick!({
                button: 0,
                metaKey: false,
                ctrlKey: false,
                shiftKey: false,
                altKey: false,
                preventDefault() {}
            });
        await settle();
        assert.deepEqual(view.navigations, ["/discover/destinations/stockholm"]);
        assert.equal(new URL(view.navigations[0], "http://localhost:3000").search, "");
        assert.equal(view.requests.length, 1);
        await assert.rejects(DestinationRoute({ params: Promise.resolve({ slug: "stockholm" }) }), /404/);
    });
}

for (const activation of ["submit", "option"] as const) {
    for (const outcome of ["primary", "nearby-provider-identity", "empty", "network"] as const) {
        test(`Stockholm prefix ${activation} uses a single clean navigation after a ${outcome} primary lookup`, async (context) => {
            const view = fixture(context);
            const selected = {
                ...destination("dXJuOm1ieHBsYzpTdG9ja2hvbG0", "Stockholm", "Sweden", "SWE"),
                latitude: 59.324337,
                longitude: 18.06902
            };
            view.type("Stockh");
            view.startRequest();
            await respond(view.requests[0], { data: [selected] });
            if (activation === "submit") view.submit();
            else
                control(view.tree(), (props) => props.id === "destination-option-0").onClick!({
                    button: 0,
                    metaKey: false,
                    ctrlKey: false,
                    shiftKey: false,
                    altKey: false,
                    preventDefault() {}
                });
            assert.equal(view.navigations.length, 0, "Wait for primary lookup before navigating");
            assert.equal(view.requests.length, 2);
            assert.equal(view.requests[1].url.searchParams.get("q"), "Stockholm");
            if (outcome === "network") {
                view.requests[1].response.reject(new TypeError("Offline"));
                await settle();
            } else {
                const primary =
                    outcome === "nearby-provider-identity"
                        ? { ...selected, id: "replacement-provider-id", latitude: 59.33, longitude: 18.07 }
                        : selected;
                await respond(view.requests[1], { data: outcome === "empty" ? [] : [primary] });
            }
            assert.deepEqual(view.navigations, ["/discover/destinations/stockholm"]);
            assert.equal(new URL(view.navigations[0], "http://localhost:3000").search, "");
            await assert.rejects(DestinationRoute({ params: Promise.resolve({ slug: "stockholm" }) }), /404/);
        });
    }
}
