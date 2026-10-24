"use client";

import { useEffect, useRef, type ReactNode } from "react";

export default function BoardEditorRail({ children }: { children: ReactNode }) {
    const viewport = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const rail = viewport.current;
        if (!rail) return;
        const desktop = window.matchMedia("(min-width: 768px)");
        const gesture = { last: 0, inner: false, lockedUntil: 0 };
        const reveal = (target: HTMLElement) => {
            const section = target.closest<HTMLElement>("[data-editor-section]");
            if (!section || target.closest('[role="dialog"]')) return;
            const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
            if (desktop.matches) {
                rail.scrollTo({ left: section.offsetLeft, behavior: reduced ? "instant" : "smooth" });
            } else section.scrollIntoView({ behavior: reduced ? "instant" : "smooth", block: "start" });
        };
        const hash = () => {
            const target = document.getElementById(window.location.hash.slice(1));
            if (target && rail.contains(target)) reveal(target);
        };
        const click = (event: MouseEvent) => {
            if (event.ctrlKey || event.metaKey || event.shiftKey || event.button !== 0) return;
            const anchor =
                event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href^="#"]') : null;
            const target = anchor ? document.getElementById(anchor.hash.slice(1)) : null;
            if (!target || !rail.contains(target)) return;
            event.preventDefault();
            history.replaceState(history.state, "", anchor!.hash);
            reveal(target);
            target.focus({ preventScroll: true });
        };
        const wheel = (event: WheelEvent) => {
            if (!desktop.matches || event.ctrlKey || event.metaKey || !(event.target instanceof Element)) return;
            if (
                event.target.closest(
                    '[role="dialog"], [data-map-interactive="true"], input, textarea, select, [role="listbox"]'
                )
            )
                return;
            const horizontal = Math.abs(event.deltaX) > Math.abs(event.deltaY) || event.shiftKey;
            const delta = horizontal && event.deltaX ? event.deltaX : event.deltaY;
            if (!delta) return;
            const now = Date.now();
            const continuing = now - gesture.last < 160;
            gesture.last = now;
            const ancestors = (element: Element | null): boolean => {
                if (!element || element === rail) return false;
                const scroll = element as HTMLElement;
                const overflow = getComputedStyle(element)[horizontal ? "overflowX" : "overflowY"];
                const position = horizontal ? scroll.scrollLeft : scroll.scrollTop;
                const limit = horizontal
                    ? scroll.scrollWidth - scroll.clientWidth
                    : scroll.scrollHeight - scroll.clientHeight;
                return (
                    (/auto|scroll/.test(overflow) && limit > 1 && (delta < 0 ? position > 1 : position < limit - 1)) ||
                    ancestors(element.parentElement)
                );
            };
            if (ancestors(event.target)) {
                gesture.inner = true;
                return;
            }
            event.preventDefault();
            if (gesture.inner && continuing) return;
            gesture.inner = false;
            if (now < gesture.lockedUntil) return;
            gesture.lockedUntil = now + 550;
            const sections = Array.from(rail.querySelectorAll<HTMLElement>("[data-editor-section]"));
            const index = Math.round(rail.scrollLeft / rail.clientWidth);
            const next = sections[Math.max(0, Math.min(sections.length - 1, index + Math.sign(delta)))];
            if (next) reveal(next);
        };
        const focus = (event: FocusEvent) => {
            if (desktop.matches && event.target instanceof HTMLElement) {
                const section = event.target.closest<HTMLElement>("[data-editor-section]");
                if (section && Math.abs(section.offsetLeft - rail.scrollLeft) > rail.clientWidth / 2)
                    reveal(event.target);
            }
        };
        document.addEventListener("click", click);
        rail.addEventListener("wheel", wheel, { passive: false });
        rail.addEventListener("focusin", focus);
        window.addEventListener("hashchange", hash);
        hash();
        return () => {
            document.removeEventListener("click", click);
            rail.removeEventListener("wheel", wheel);
            rail.removeEventListener("focusin", focus);
            window.removeEventListener("hashchange", hash);
        };
    }, []);

    return (
        <div ref={viewport} className="board-editor-rail" aria-label="Board editor sections">
            {children}
        </div>
    );
}
