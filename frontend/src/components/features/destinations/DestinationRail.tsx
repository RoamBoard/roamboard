"use client";

import { useCallback, useEffect, useRef, type ReactNode } from "react";
import { useReducedMotion } from "motion/react";

// Four screen-sized chapters use native snapping; wheel and keyboard advance one chapter at a time.
export function DestinationRail({ name, children }: { name: string; children: ReactNode }) {
    const viewport = useRef<HTMLDivElement>(null);
    const reduced = useReducedMotion();
    const reveal = useCallback(
        (target: HTMLElement) => {
            const container = viewport.current;
            if (!container) return;
            const chapter = target.closest<HTMLElement>("[data-destination-chapter]") ?? target;
            const bounds = chapter.getBoundingClientRect();
            const frame = container.getBoundingClientRect();
            if (bounds.left >= frame.left - 1 && bounds.right <= frame.right + 1) return;
            container.scrollTo({
                left: container.scrollLeft + bounds.left - frame.left,
                behavior: reduced ? "instant" : "smooth"
            });
        },
        [reduced]
    );

    useEffect(() => {
        const container = viewport.current;
        if (!container) return;
        const gesture = { locked: false, timer: 0 };
        const wheel = (event: WheelEvent) => {
            // Leave map wheel events to Mapbox so zooming never moves the guide sideways.
            if (event.target instanceof Element && event.target.closest(".mapboxgl-map")) return;
            if (event.ctrlKey || event.metaKey) return;
            event.preventDefault();
            const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
            if (!delta) return;
            const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? container.clientWidth : 1;
            const gallery =
                event.target instanceof Element ? event.target.closest<HTMLElement>("[data-destination-scroll]") : null;
            // At either gallery edge, keep scrolling through the page instead of trapping the wheel.
            if (gallery) {
                const atStart = gallery.scrollLeft <= 1;
                const atEnd = gallery.scrollLeft >= gallery.scrollWidth - gallery.clientWidth - 1;
                if ((delta < 0 && !atStart) || (delta > 0 && !atEnd)) {
                    gallery.scrollLeft += delta * unit;
                    return;
                }
            }
            // Pause briefly between chapters without requiring the user to stop scrolling.
            if (gesture.locked) return;
            gesture.locked = true;
            gesture.timer = window.setTimeout(() => {
                gesture.locked = false;
            }, 500);
            const chapter = Math.round(container.scrollLeft / container.clientWidth);
            container.scrollTo({
                left: (chapter + Math.sign(delta)) * container.clientWidth,
                behavior: reduced ? "instant" : "smooth"
            });
        };
        container.addEventListener("wheel", wheel, { passive: false });
        const restoreHash = () => {
            const target = document.getElementById(window.location.hash.slice(1));
            if (target && container.contains(target)) reveal(target);
        };
        restoreHash();
        window.addEventListener("hashchange", restoreHash);
        return () => {
            container.removeEventListener("wheel", wheel);
            window.clearTimeout(gesture.timer);
            window.removeEventListener("hashchange", restoreHash);
        };
    }, [reveal, reduced]);

    return (
        <div
            className="font-body bg-background text-foreground @container h-dvh min-w-0 overflow-hidden [--destination-width:100cqw]"
            onClickCapture={(event) => {
                const anchor =
                    event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href^="#"]') : null;
                const target = anchor ? document.getElementById(anchor.hash.slice(1)) : null;
                if (target && viewport.current?.contains(target)) {
                    event.preventDefault();
                    reveal(target);
                    target.focus({ preventScroll: true });
                }
            }}
        >
            <a
                href="#destination-boards"
                className="bg-background fixed top-4 left-20 z-50 -translate-y-24 px-5 py-3 focus:translate-y-0"
            >
                Skip to public boards
            </a>
            <div
                ref={viewport}
                role="region"
                aria-label={`${name} horizontal destination guide`}
                tabIndex={0}
                className="h-full w-full snap-x snap-mandatory [scrollbar-width:none] overflow-x-auto overflow-y-hidden overscroll-none focus-visible:outline-2 focus-visible:-outline-offset-2 [&::-webkit-scrollbar]:hidden"
                onFocusCapture={(event) => {
                    if (event.target instanceof HTMLElement && event.target !== event.currentTarget)
                        reveal(event.target);
                }}
                onKeyDown={(event) => {
                    if (
                        event.ctrlKey ||
                        event.altKey ||
                        event.metaKey ||
                        !(event.target instanceof Element) ||
                        event.target.closest("input, textarea, select, [role=slider], .mapboxgl-map")
                    )
                        return;
                    if (
                        event.target.closest("[data-destination-scroll]") &&
                        ["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)
                    )
                        return;
                    if (
                        ![
                            "ArrowLeft",
                            "ArrowRight",
                            "ArrowUp",
                            "ArrowDown",
                            "PageUp",
                            "PageDown",
                            "Home",
                            "End",
                            " "
                        ].includes(event.key)
                    )
                        return;
                    if (event.key === " " && event.target.closest("a, button")) return;
                    event.preventDefault();
                    const container = event.currentTarget;
                    const backwards =
                        ["ArrowLeft", "ArrowUp", "PageUp"].includes(event.key) || (event.key === " " && event.shiftKey);
                    const nextChapter = container.scrollLeft + container.clientWidth * (backwards ? -1 : 1);
                    const next = event.key === "Home" ? 0 : event.key === "End" ? container.scrollWidth : nextChapter;
                    container.scrollTo({ left: next, behavior: reduced ? "instant" : "smooth" });
                }}
            >
                <div className="relative flex h-full w-max items-stretch">{children}</div>
            </div>
        </div>
    );
}
