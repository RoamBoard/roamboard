import assert from "node:assert/strict";
import test from "node:test";
import React, { Children, isValidElement, type ReactElement, type ReactNode } from "react";
import DestinationPlaces from "../src/components/features/destinations/DestinationPlaces";
import type { DestinationGuideData } from "../src/lib/destination-guides";

type Node = ReactElement<Record<string, unknown>>;
function nodes(tree: ReactNode): Node[] {
    if (!isValidElement<Record<string, unknown>>(tree)) return [];
    return [tree, ...Children.toArray(tree.props.children as ReactNode).flatMap(nodes)];
}
const guide: DestinationGuideData = {
    destination: {
        name: "Japan",
        country: "Japan",
        countryCode: "JPN",
        latitude: 36.5,
        longitude: 139,
        kind: "country"
    },
    article: null,
    cityTip: null,
    images: [],
    boards: [],
    unavailable: [],
    page: 1,
    hasMore: false,
    places: [
        {
            id: "wikivoyage:42:tokyo",
            provider: "wikivoyage",
            name: "Tokyo",
            address: "Japan",
            latitude: 35.6762,
            longitude: 139.6503
        },
        {
            id: "wikivoyage:42:kyoto",
            provider: "wikivoyage",
            name: "Kyoto",
            address: "Japan",
            latitude: 35.0116,
            longitude: 135.7681
        }
    ]
};

test("country city selection loads credited details and opens the existing city guide without rematching its marker", async (t) => {
    const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
    Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: { matchMedia: () => ({ matches: false }) }
    });
    t.after(() => {
        if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
        else Reflect.deleteProperty(globalThis, "window");
    });
    const slots: unknown[] = [];
    const cursor = { value: 0 };
    const effects: Array<() => void | (() => void)> = [];
    t.mock.method(React, "useState", ((initial: unknown) => {
        const index = cursor.value++;
        if (!(index in slots)) slots[index] = typeof initial === "function" ? initial() : initial;
        return [
            slots[index],
            (next: unknown) => {
                slots[index] = typeof next === "function" ? next(slots[index]) : next;
            }
        ];
    }) as typeof React.useState);
    t.mock.method(React, "useRef", ((initial: unknown) => {
        const index = cursor.value++;
        slots[index] ??= { current: initial };
        return slots[index];
    }) as typeof React.useRef);
    t.mock.method(React, "useMemo", ((compute: () => unknown) => compute()) as typeof React.useMemo);
    t.mock.method(React, "useEffect", (effect: React.EffectCallback) => {
        effects.push(effect);
    });
    const calls: URL[] = [];
    t.mock.method(globalThis, "fetch", async (input: string | URL | Request) => {
        const url = new URL(String(input));
        calls.push(url);
        if (url.pathname.endsWith("/place-details"))
            return Response.json({
                data: {
                    placeId: url.searchParams.get("placeId"),
                    description: "Tokyo has temples and busy railway stations.",
                    sourceUrl: "https://en.wikivoyage.org/?curid=42#Cities",
                    unavailable: [],
                    image: {
                        url: "https://upload.wikimedia.org/wikipedia/commons/t/t1/Tokyo.jpg",
                        alt: "Tokyo",
                        width: 1200,
                        height: 800,
                        author: "City Photographer",
                        sourceUrl: "https://commons.wikimedia.org/wiki/File:Tokyo.jpg",
                        licenseName: "CC BY-SA 4.0",
                        licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/"
                    }
                }
            });
        return Response.json({ data: { publicToken: "test-map-token" } });
    });
    const render = async () => {
        cursor.value = 0;
        effects.length = 0;
        const tree = DestinationPlaces({ guide });
        for (const effect of effects) effect();
        await new Promise<void>((resolve) => setImmediate(resolve));
        return nodes(tree);
    };
    const initial = await render();
    const heading = initial.find((node) => node.props.id === "destination-places-heading");
    assert.equal(heading?.props.children, "Cities to explore");
    const tokyo = initial.find((node) => node.type === "button" && node.props["aria-label"] === "Explore Tokyo");
    assert.ok(tokyo);
    (tokyo.props.onClick as () => void)();
    const selected = await render();
    const map = selected.find((node) => node.props.selectedPointId === "wikivoyage:42:tokyo");
    assert.ok(map, "Selecting a city must focus its existing map marker");
    assert.equal(map.props.selectedZoom, 6, "Country city selection should show the city area");
    const action = selected.find(
        (node) => typeof node.props.href === "string" && node.props.href.startsWith("/discover/destinations/tokyo?")
    );
    assert.ok(action);
    assert.ok(nodes(action).some((node) => node.props.children === "Explore Tokyo"));
    const url = new URL(action.props.href as string, "https://roamboard.example");
    assert.deepEqual(Object.fromEntries(url.searchParams), {
        name: "Tokyo",
        country: "JPN",
        latitude: "35.6762",
        longitude: "139.6503"
    });
    assert.equal(
        selected.some((node) => typeof node.props.href === "string" && node.props.href.startsWith("/boards/new?")),
        false
    );
    assert.ok(calls.length > 0, "The shared map still loads its session");
    const details = calls.find((url) => url.pathname.endsWith("/place-details"));
    assert.ok(details, "A selected city must load its country listing details");
    assert.equal(details.searchParams.get("kind"), "country");
    assert.equal(details.searchParams.get("placeId"), "wikivoyage:42:tokyo");
    const loaded = await render();
    assert.ok(loaded.some((node) => node.props.children === "Tokyo has temples and busy railway stations."));
    assert.ok(loaded.some((node) => node.props.children === "City Photographer"));
    assert.ok(loaded.some((node) => node.props.href === "https://commons.wikimedia.org/wiki/File:Tokyo.jpg"));
    assert.ok(loaded.some((node) => node.props.href === "https://creativecommons.org/licenses/by-sa/4.0/"));
    assert.equal(
        calls.some((url) => /match-place/.test(url.pathname)),
        false
    );
    (map.props.onPointClick as (point: { id: string }) => void)({ id: "wikivoyage:42:kyoto" });
    const kyoto = await render();
    assert.ok(kyoto.some((node) => node.props.selectedPointId === "wikivoyage:42:kyoto"));
    const kyotoAction = kyoto.find(
        (node) => typeof node.props.href === "string" && node.props.href.startsWith("/discover/destinations/kyoto?")
    );
    assert.ok(kyotoAction, "Map marker selection must open the matching city guide");
    const kyotoUrl = new URL(kyotoAction.props.href as string, "https://roamboard.example");
    assert.equal(kyotoUrl.searchParams.get("latitude"), "35.0116");
    assert.equal(kyotoUrl.searchParams.get("longitude"), "135.7681");
    assert.equal(
        calls.some((url) => /match-place/.test(url.pathname)),
        false
    );
});
