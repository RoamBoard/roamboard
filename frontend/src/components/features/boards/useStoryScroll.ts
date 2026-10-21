"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useMotionValue } from "motion/react";

const desktopQuery = "(min-width: 1024px) and (min-height: 620px) and (prefers-reduced-motion: no-preference)";
const subscribe = (listener: () => void) => {
    const query = window.matchMedia(desktopQuery);
    query.addEventListener("change", listener);
    return () => query.removeEventListener("change", listener);
};
const getDesktop = () => window.matchMedia(desktopQuery).matches;

export default function useStoryScroll(chapterKey: string) {
    const desktop = useSyncExternalStore(subscribe, getDesktop, () => false);
    const track = useRef<HTMLDivElement>(null);
    const viewport = useRef<HTMLDivElement>(null);
    const rail = useRef<HTMLDivElement>(null);
    const x = useMotionValue(0);
    const [size, setSize] = useState({ width: 0, height: 0, travel: 0 });
    const [chapter, setChapter] = useState("overview");
    const [activityId, setActivityId] = useState<string>();
    const stableChapter = useRef("overview");
    const restoredHash = useRef("");

    useEffect(() => {
        const element = viewport.current;
        const content = rail.current;
        if (!element || !content) return;
        const measure = () => {
            const width = element.clientWidth;
            element.style.setProperty("--story-width", `${width}px`);
            const next = { width, height: window.innerHeight - 52, travel: Math.max(0, content.scrollWidth - width) };
            setSize((current) =>
                current.width === next.width && current.height === next.height && current.travel === next.travel
                    ? current
                    : next
            );
        };
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(element);
        observer.observe(content);
        window.addEventListener("resize", measure);
        return () => {
            observer.disconnect();
            window.removeEventListener("resize", measure);
        };
    }, [desktop, chapterKey]);

    const scrollToChapter = useCallback(
        (id: string, smooth: boolean) => {
            const target = document.getElementById(id);
            if (!target || !track.current || !rail.current) return;
            const start = track.current.getBoundingClientRect().top + window.scrollY - 52;
            const top =
                desktop && rail.current.contains(target)
                    ? start + target.offsetLeft
                    : target.getBoundingClientRect().top + window.scrollY - 64;
            window.scrollTo({
                top: Math.max(0, top),
                behavior:
                    smooth && !window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "smooth" : "instant"
            });
            setChapter(id === "comments" || id.startsWith("comment-") ? "ending" : id);
            stableChapter.current = id;
        },
        [desktop]
    );

    useEffect(() => {
        const frame = { id: 0 };
        const update = () => {
            frame.id = 0;
            if (!track.current || !rail.current || !viewport.current) return;
            const start = track.current.getBoundingClientRect().top + window.scrollY - 52;
            const distance = Math.max(0, Math.min(size.travel, window.scrollY - start));
            x.set(desktop ? -distance : 0);
            const sections = [...rail.current.querySelectorAll<HTMLElement>("[data-story-chapter]")];
            const current = desktop
                ? sections.find((section) => section.offsetLeft + section.offsetWidth > distance + size.width / 2)
                : sections.find((section) => section.getBoundingClientRect().bottom > window.innerHeight / 2);
            const ending = document.getElementById("ending");
            const atEnd = ending && ending.getBoundingClientRect().top <= window.innerHeight / 2;
            const previous = sections.find((section) => section.id === stableChapter.current);
            // Small reversals at a day boundary should not flicker the map's automatic filter.
            const center = distance + size.width / 2;
            const retained =
                desktop &&
                previous &&
                center >= previous.offsetLeft - 20 &&
                center <= previous.offsetLeft + previous.offsetWidth + 20;
            const nextChapter = atEnd ? "ending" : retained ? previous.id : current?.id;
            if (nextChapter) {
                stableChapter.current = nextChapter;
                setChapter(nextChapter);
            }
            const candidates = [...rail.current.querySelectorAll<HTMLElement>("[data-story-activity]")];
            const visible = candidates.filter((element) => {
                const rect = element.getBoundingClientRect();
                return desktop
                    ? rect.right > 0 && rect.left < window.innerWidth
                    : rect.bottom > 52 && rect.top < window.innerHeight;
            });
            const nearest = visible.reduce<HTMLElement | undefined>((best, element) => {
                const rect = element.getBoundingClientRect();
                const previous = best?.getBoundingClientRect();
                const position = desktop
                    ? rect.left + rect.width / 2 - (viewport.current!.getBoundingClientRect().left + size.width / 2)
                    : rect.top + rect.height / 2 - window.innerHeight / 2;
                const before = previous
                    ? desktop
                        ? previous.left +
                          previous.width / 2 -
                          (viewport.current!.getBoundingClientRect().left + size.width / 2)
                        : previous.top + previous.height / 2 - window.innerHeight / 2
                    : Infinity;
                return Math.abs(position) < Math.abs(before) ? element : best;
            }, undefined);
            setActivityId(nearest?.dataset.storyActivity);
        };
        const schedule = () => {
            if (!frame.id) frame.id = requestAnimationFrame(update);
        };
        update();
        window.addEventListener("scroll", schedule, { passive: true });
        return () => {
            cancelAnimationFrame(frame.id);
            window.removeEventListener("scroll", schedule);
        };
    }, [desktop, size, x]);

    useEffect(() => {
        if (desktop && !size.width) return;
        const restore = () => {
            const id = window.location.hash.slice(1);
            const signature = `${id}:${desktop}`;
            if (id && restoredHash.current !== signature) {
                restoredHash.current = signature;
                scrollToChapter(id, false);
            }
        };
        const navigate = () => {
            restoredHash.current = "";
            restore();
        };
        const frame = requestAnimationFrame(restore);
        window.addEventListener("hashchange", navigate);
        window.addEventListener("popstate", navigate);
        return () => {
            cancelAnimationFrame(frame);
            window.removeEventListener("hashchange", navigate);
            window.removeEventListener("popstate", navigate);
        };
    }, [desktop, size.width, size.travel, scrollToChapter]);

    const jump = (id: string) => {
        if (window.location.hash !== `#${id}`) window.history.pushState(window.history.state, "", `#${id}`);
        scrollToChapter(id, true);
        restoredHash.current = `${id}:${desktop}`;
        document.getElementById(id)?.focus({ preventScroll: true });
    };
    return { desktop, track, viewport, rail, x, size, chapter, activityId, jump };
}
