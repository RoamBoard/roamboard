"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

const query = "(min-width: 1024px) and (min-height: 620px)";
const subscribe = (listener: () => void) => {
    const media = window.matchMedia(query);
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
};

function innerScroller(target: Element, boundary: HTMLElement, direction: number): boolean {
    if (target === boundary) return false;
    if (
        target instanceof HTMLElement &&
        /auto|scroll/.test(getComputedStyle(target).overflowY) &&
        target.scrollHeight > target.clientHeight + 1 &&
        (direction < 0 ? target.scrollTop > 1 : target.scrollTop < target.scrollHeight - target.clientHeight - 1)
    )
        return true;
    return target.parentElement ? innerScroller(target.parentElement, boundary, direction) : false;
}

// Native snap scrolling mirrors the destination guide; maps and editable controls keep their own gestures.
export default function useStoryScroll(chapterKey: string) {
    const desktop = useSyncExternalStore(
        subscribe,
        () => window.matchMedia(query).matches,
        () => false
    );
    const track = useRef<HTMLDivElement>(null);
    const viewport = useRef<HTMLDivElement>(null);
    const rail = useRef<HTMLDivElement>(null);
    const [sceneId, setSceneId] = useState("overview");
    const chapter = sceneId.replace(/-part-2$/, "");
    const behavior = () =>
        window.matchMedia("(prefers-reduced-motion: reduce)").matches ? ("instant" as const) : ("smooth" as const);

    const reveal = useCallback(
        (id: string, smooth = true) => {
            const target = document.getElementById(id);
            const container = viewport.current;
            if (!target || !container || !track.current) return;
            const isScene = rail.current?.contains(target);
            if (desktop && isScene) {
                window.scrollTo({
                    top: track.current.getBoundingClientRect().top + window.scrollY - 52,
                    behavior: "instant"
                });
                container.scrollTo({ left: target.offsetLeft, behavior: smooth ? behavior() : "instant" });
            } else target.scrollIntoView({ block: "start", behavior: smooth ? behavior() : "instant" });
            setSceneId(id === "comments" || id.startsWith("comment-") ? "ending" : id);
        },
        [desktop]
    );

    useEffect(() => {
        const container = viewport.current;
        const wrapper = track.current;
        const content = rail.current;
        if (!container || !wrapper || !content) return;
        const sections = () => [...content.querySelectorAll<HTMLElement>("[data-story-scene]")];
        const gesture = { locked: false, timer: 0, inner: false, last: 0 };
        const update = () => {
            if (desktop) {
                const scene = sections().reduce<HTMLElement | undefined>(
                    (best, item) =>
                        !best ||
                        Math.abs(item.offsetLeft - container.scrollLeft) <
                            Math.abs(best.offsetLeft - container.scrollLeft)
                            ? item
                            : best,
                    undefined
                );
                if (scene && wrapper.getBoundingClientRect().bottom > 80) setSceneId(scene.id);
            } else {
                const scene = sections().find((item) => item.getBoundingClientRect().bottom > window.innerHeight / 2);
                if (scene) setSceneId(scene.id);
            }
            const ending = document.getElementById("ending");
            if (ending && ending.getBoundingClientRect().top < window.innerHeight / 2) setSceneId("ending");
        };
        const move = (direction: number) => {
            const scenes = sections();
            const index = Math.round(container.scrollLeft / Math.max(1, container.clientWidth));
            const next = scenes[index + direction];
            if (next) container.scrollTo({ left: next.offsetLeft, behavior: behavior() });
            else if (direction > 0) reveal("ending");
        };
        const wheel = (event: WheelEvent) => {
            if (
                !desktop ||
                event.ctrlKey ||
                event.metaKey ||
                !(event.target instanceof Element) ||
                event.target.closest(".mapboxgl-map, input, textarea, select, [role=slider], dialog")
            )
                return;
            const horizontal = Math.abs(event.deltaX) > Math.abs(event.deltaY);
            const delta = horizontal ? event.deltaX : event.deltaY;
            if (!delta) return;
            const continuing = Date.now() - gesture.last < 160;
            gesture.last = Date.now();
            if (!horizontal && innerScroller(event.target, wrapper, delta)) {
                gesture.inner = true;
                return;
            }
            event.preventDefault();
            if (!horizontal && gesture.inner && continuing) return;
            gesture.inner = false;
            if (gesture.locked) return;
            gesture.locked = true;
            gesture.timer = window.setTimeout(() => {
                gesture.locked = false;
            }, 500);
            move(Math.sign(delta));
        };
        const key = (event: KeyboardEvent) => {
            if (
                !desktop ||
                event.defaultPrevented ||
                event.ctrlKey ||
                event.metaKey ||
                event.altKey ||
                !(event.target instanceof Element) ||
                event.target.closest("input,textarea,select,[role=slider],.mapboxgl-map,dialog")
            )
                return;
            if (
                !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "].includes(
                    event.key
                )
            )
                return;
            if (event.key === " " && event.target.closest("a,button,summary")) return;
            const direction =
                ["ArrowLeft", "ArrowUp", "PageUp", "Home"].includes(event.key) || (event.key === " " && event.shiftKey)
                    ? -1
                    : 1;
            if (innerScroller(event.target, wrapper, direction) && !["ArrowLeft", "ArrowRight"].includes(event.key))
                return;
            event.preventDefault();
            if (event.key === "Home") reveal("overview");
            else if (event.key === "End") reveal("ending");
            else move(direction);
        };
        const focus = (event: FocusEvent) => {
            if (!desktop || !(event.target instanceof Element)) return;
            const scene = event.target.closest<HTMLElement>("[data-story-scene]");
            if (scene && Math.abs(scene.offsetLeft - container.scrollLeft) > container.clientWidth / 2)
                reveal(scene.id);
        };
        const observer = new ResizeObserver(() => {
            container.style.setProperty("--story-width", `${container.clientWidth}px`);
            update();
        });
        observer.observe(container);
        container.style.setProperty("--story-width", `${container.clientWidth}px`);
        wrapper.addEventListener("wheel", wheel, { passive: false });
        wrapper.addEventListener("keydown", key);
        container.addEventListener("scroll", update, { passive: true });
        content.addEventListener("focusin", focus);
        window.addEventListener("scroll", update, { passive: true });
        update();
        return () => {
            observer.disconnect();
            window.clearTimeout(gesture.timer);
            wrapper.removeEventListener("wheel", wheel);
            wrapper.removeEventListener("keydown", key);
            container.removeEventListener("scroll", update);
            content.removeEventListener("focusin", focus);
            window.removeEventListener("scroll", update);
        };
    }, [desktop, chapterKey, reveal]);

    useEffect(() => {
        const restore = () => {
            const id = window.location.hash.slice(1);
            if (id) reveal(id, false);
        };
        const frame = requestAnimationFrame(restore);
        window.addEventListener("hashchange", restore);
        window.addEventListener("popstate", restore);
        return () => {
            cancelAnimationFrame(frame);
            window.removeEventListener("hashchange", restore);
            window.removeEventListener("popstate", restore);
        };
    }, [reveal]);
    const jump = (id: string) => {
        if (window.location.hash !== `#${id}`) window.history.pushState(window.history.state, "", `#${id}`);
        reveal(id);
        document.getElementById(id)?.focus({ preventScroll: true });
    };
    return { desktop, track, viewport, rail, sceneId, chapter, jump };
}
