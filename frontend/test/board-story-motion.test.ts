import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import React, { Children, isValidElement, type ReactNode } from "react";

import StoryPhoto from "../src/components/features/boards/StoryPhoto";
import BoardCardTilt from "../src/components/features/boards/cards/BoardCardTilt";

type Props = { children?: ReactNode; [key: string]: unknown };

function descendants(node: ReactNode): Array<{ type: unknown; props: Props }> {
    return Children.toArray(node).flatMap((child) => {
        if (!isValidElement<Props>(child)) return [];
        return [{ type: child.type, props: child.props }, ...descendants(child.props.children)];
    });
}

function mountPhoto(context: TestContext, thumbnail: boolean) {
    const calls = { observers: 0, animations: 0, opened: 0 };
    const previous = ["window", "IntersectionObserver"].map((key) => ({
        key,
        descriptor: Object.getOwnPropertyDescriptor(globalThis, key)
    }));
    Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: { matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }) }
    });
    Object.defineProperty(globalThis, "IntersectionObserver", {
        configurable: true,
        value: class {
            constructor() {
                calls.observers++;
            }
            observe() {}
            disconnect() {}
        }
    });
    const hooks = { useState: React.useState, useRef: React.useRef, useEffect: React.useEffect };
    const effects: Array<() => void | (() => void)> = [];
    const cleanups: Array<() => void> = [];
    React.useState = ((initial?: unknown) => [initial, () => {}]) as typeof React.useState;
    React.useRef = (() => ({
        current: {
            animate: () => {
                calls.animations++;
                return { cancel() {} };
            }
        }
    })) as typeof React.useRef;
    React.useEffect = (effect) => {
        effects.push(effect);
    };
    const tree = (() => {
        try {
            return StoryPhoto({
                image: {
                    id: "lake-photo",
                    url: "https://photos.example.test/lake",
                    source: "upload",
                    alt: "Morning at the lake",
                    width: 1600,
                    height: 1200
                },
                thumbnail,
                onOpen: () => {
                    calls.opened++;
                }
            });
        } finally {
            Object.assign(React, hooks);
        }
    })();
    effects.forEach((effect) => {
        const cleanup = effect();
        if (cleanup) cleanups.push(cleanup);
    });
    context.after(() => {
        cleanups.forEach((cleanup) => cleanup());
        previous.forEach(({ key, descriptor }) => {
            if (descriptor) Object.defineProperty(globalThis, key, descriptor);
            else Reflect.deleteProperty(globalThis, key);
        });
    });
    return { calls, nodes: descendants(tree) };
}

for (const thumbnail of [false, true]) {
    test(`${thumbnail ? "summary thumbnails" : "scene photos"} appear immediately without entrance observers or animations`, (context) => {
        const photo = mountPhoto(context, thumbnail);
        assert.equal(photo.calls.observers, 0, "Entering or changing scenes must not stage photograph entrances");
        assert.equal(photo.calls.animations, 0);
        assert.equal(
            photo.nodes.some((node) => node.type === BoardCardTilt),
            false,
            "Photos must not tilt or lift on hover"
        );
        const trigger = photo.nodes.find((node) => node.type === "button");
        assert.equal(trigger?.props["aria-label"], "Enlarge Morning at the lake");
        const classes = String(trigger?.props.className);
        const scale = classes.match(/hover:scale-\[([\d.]+)\]/);
        assert.ok(scale && Number(scale[1]) > 1 && Number(scale[1]) <= 1.02, "Hover enlarges the photo only slightly");
        assert.doesNotMatch(classes, /(?:translate|rotate|origin-(?:top|bottom|left|right))/);
        assert.ok(classes.includes("motion-reduce:transform-none"), "Reduced motion disables hover movement");
        (trigger?.props.onClick as () => void)();
        assert.equal(photo.calls.opened, 1, "The gentle hover wrapper preserves photo activation");
    });
}
