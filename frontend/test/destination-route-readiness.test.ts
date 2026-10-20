import assert from "node:assert/strict";
import test from "node:test";
import { Children, isValidElement, type ReactNode } from "react";
import DestinationRoute from "../src/app/discover/destinations/[slug]/page";
import { DestinationReady } from "../src/components/features/destinations/DestinationTransitionProvider";
import { destinationGuideHref } from "../src/lib/destination-guides";
import { createDestinationLoadingStore } from "../src/lib/destination-loading";
import type { Destination } from "../src/lib/destinations";
import type { DestinationSelectionParams } from "../src/lib/destination-search";

function readyHref(node: ReactNode): string | undefined {
    if (!isValidElement<{ href?: string; children?: ReactNode }>(node)) return;
    if (node.type === DestinationReady) return node.props.href;
    return Children.toArray(node.props.children).map(readyHref).find(Boolean);
}

function selectedCity(name: string): Destination {
    return {
        id: "selected-provider-city",
        name,
        address: `${name}, Spain`,
        latitude: 43.32282,
        longitude: -1.984026,
        placeType: "place",
        context: ["Spain"],
        country: "Spain",
        countryCode: "ESP",
        city: name
    };
}

async function routeReady(href: string, decodedSlug = false) {
    const url = new URL(href, "https://roamboard.test");
    const encodedSlug = url.pathname.split("/").at(-1)!;
    const selection: DestinationSelectionParams = {};
    url.searchParams.forEach((_value, key) => {
        const values = url.searchParams.getAll(key);
        selection[key] = values.length > 1 ? values : values[0];
    });
    const tree = await DestinationRoute({
        params: Promise.resolve({ slug: decodedSlug ? decodeURIComponent(encodedSlug) : encodedSlug }),
        searchParams: Promise.resolve(selection)
    });
    const ready = readyHref(tree);
    assert.ok(ready, "The real destination route must announce its resolved page identity");
    return ready;
}

test("country guide identity retains country scope and exactly-once encoding through route readiness", async () => {
    const href = destinationGuideHref({
        ...selectedCity("Côte d’Ivoire"),
        placeType: "country",
        country: "Côte d’Ivoire",
        countryCode: "CIV",
        latitude: 7.54,
        longitude: -5.55
    });
    assert.ok(href);
    assert.equal(new URL(href, "https://roamboard.test").searchParams.get("kind"), "country");
    assert.equal(await routeReady(href), href);
});

test("actual destination routes release the selected overlay for raw and encoded accent, non-Latin and reserved path segments", async (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const store = createDestinationLoadingStore();
    t.after(() => store.dispose());
    for (const name of ["San Sebastián", "Stockholm", "東京", "A/B?C#D% & waterfront", "Literal %2F waterfront"]) {
        const href = destinationGuideHref(selectedCity(name));
        assert.ok(href);
        for (const decoded of name.includes("%") ? [false] : [false, true]) {
            await store.begin(name, async () => href);
            store.ready(await routeReady(href, decoded));
            assert.equal(store.getSnapshot()?.pageReady, true, `${name}: route identity must match selection`);
            t.mock.timers.tick(2999);
            assert.equal(store.getSnapshot()?.phase, "loading", "The existing three-second introduction remains");
            t.mock.timers.tick(1);
            assert.equal(store.getSnapshot()?.phase, "revealing");
        }
    }
});

test("encoded route readiness retains all namesake selectors and cannot reveal a different destination", async (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const store = createDestinationLoadingStore();
    t.after(() => store.dispose());
    const href = `${destinationGuideHref(selectedCity("San Sebastián"))}&id=place%2F123&type=place&lat=43.32282&lon=-1.984026&context=city&context=coast`;
    await store.begin("San Sebastián", async () => href);
    t.mock.timers.tick(3000);
    for (const [key, value] of [
        ["country", "USA"],
        ["latitude", "32"],
        ["longitude", "-97"],
        ["id", "other-provider"],
        ["type", "region"],
        ["lat", "32"],
        ["lon", "-97"]
    ]) {
        const wrong = new URL(href, "https://roamboard.test");
        wrong.searchParams.set(key, value);
        store.ready(await routeReady(`${wrong.pathname}${wrong.search}`));
        assert.equal(store.getSnapshot()?.pageReady, false, `Changed ${key} must not release this overlay`);
    }
    const ready = await routeReady(href);
    assert.deepEqual(new URL(ready, "https://roamboard.test").searchParams.getAll("context"), ["city", "coast"]);
    store.ready(ready);
    assert.equal(store.getSnapshot()?.phase, "revealing");
});

test("encoded stale or cancelled pages cannot release another overlay and genuine missing readiness still times out", async (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const store = createDestinationLoadingStore();
    t.after(() => store.dispose());
    const oldHref = destinationGuideHref(selectedCity("San Sebastián"))!;
    const nextHref = destinationGuideHref(selectedCity("東京"))!;
    await store.begin("San Sebastián", async () => oldHref);
    store.cancel();
    store.ready(await routeReady(oldHref));
    assert.equal(store.getSnapshot(), null);
    await store.begin("東京", async () => nextHref);
    store.ready(await routeReady(oldHref));
    t.mock.timers.tick(24999);
    assert.equal(store.getSnapshot()?.phase, "loading");
    assert.equal(store.getSnapshot()?.pageReady, false);
    t.mock.timers.tick(1);
    assert.equal(store.getSnapshot()?.phase, "error");
    store.ready(await routeReady(nextHref));
    assert.equal(store.getSnapshot()?.phase, "error", "Late readiness must not erase a real timeout");
});

test("literal encoded-looking names remain distinct from reserved characters and malformed route escapes fail", async () => {
    const literal = destinationGuideHref(selectedCity("Harbour %2F Market"))!;
    const slash = destinationGuideHref(selectedCity("Harbour / Market"))!;
    assert.match(new URL(literal, "https://roamboard.test").pathname, /%252F/i);
    assert.match(new URL(slash, "https://roamboard.test").pathname, /%2F/i);
    assert.notEqual(await routeReady(literal), await routeReady(slash));
    for (const slug of ["broken%", "broken%2", "broken%GG", "broken%C3"]) {
        await assert.rejects(
            DestinationRoute({
                params: Promise.resolve({ slug }),
                searchParams: Promise.resolve({ name: "Broken", country: "ESP", latitude: "43", longitude: "-2" })
            }),
            "Malformed route escapes must not be guessed into a valid page identity"
        );
    }
});
