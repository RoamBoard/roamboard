"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { ArrowLeft, ArrowRight } from "lucide-react";

const chapters = [
    { id: "guide", label: "Guide" },
    { id: "destination-boards", label: "Boards" },
    { id: "atlas", label: "Trending" },
    { id: "destination-create", label: "Create" }
];

export function DestinationRail({
    name,
    children,
    credits
}: {
    name: string;
    children: ReactNode;
    credits: ReactNode;
}) {
    const rail = useRef<HTMLDivElement>(null);
    const reduced = useReducedMotion();
    const [position, setPosition] = useState({ progress: 0, chapter: "guide", previous: false, next: true });

    function revealChapter(id: string, focus = false) {
        const container = rail.current;
        const target = document.getElementById(id);
        if (!container || !target || !container.contains(target)) return;
        const left =
            container.scrollLeft + target.getBoundingClientRect().left - container.getBoundingClientRect().left;
        container.scrollTo({ left, behavior: reduced ? "instant" : "smooth" });
        if (focus) {
            target.scrollTo({ top: 0, behavior: "instant" });
            target.focus({ preventScroll: true });
        }
    }

    function move(direction: number) {
        const container = rail.current;
        if (container)
            container.scrollBy({
                left: container.clientWidth * 0.85 * direction,
                behavior: reduced ? "instant" : "smooth"
            });
    }

    useEffect(() => {
        const container = rail.current;
        if (!container) return;
        const update = () => {
            const maximum = Math.max(0, container.scrollWidth - container.clientWidth);
            const chapter =
                chapters
                    .filter(({ id }) => {
                        const target = document.getElementById(id);
                        return (
                            target &&
                            target.getBoundingClientRect().left - container.getBoundingClientRect().left <=
                                container.clientWidth * 0.5
                        );
                    })
                    .at(-1)?.id ?? "guide";
            setPosition({
                progress: maximum ? Math.round((container.scrollLeft / maximum) * 100) : 0,
                chapter,
                previous: container.scrollLeft > 1,
                next: container.scrollLeft < maximum - 1
            });
        };
        const restoreHash = () => {
            const target = document.getElementById(window.location.hash.slice(1));
            if (target && container.contains(target))
                container.scrollTo({
                    left:
                        container.scrollLeft +
                        target.getBoundingClientRect().left -
                        container.getBoundingClientRect().left,
                    behavior: "instant"
                });
        };
        const observer = new ResizeObserver(update);
        observer.observe(container);
        Array.from(container.children).forEach((child) => {
            if (child instanceof HTMLElement) observer.observe(child);
        });
        container.addEventListener("scroll", update, { passive: true });
        window.addEventListener("hashchange", restoreHash);
        const frame = requestAnimationFrame(() => {
            restoreHash();
            update();
        });
        return () => {
            cancelAnimationFrame(frame);
            observer.disconnect();
            container.removeEventListener("scroll", update);
            window.removeEventListener("hashchange", restoreHash);
        };
    }, []);

    const midnight = position.chapter === "atlas";
    const navigationTheme = midnight
        ? "[--background:var(--atlas-background)] [--foreground:var(--atlas-foreground)] [--muted-foreground:var(--atlas-muted)] [--line:var(--atlas-line)]"
        : "";
    return (
        <div className="font-body bg-background text-foreground ml-16 flex h-[calc(100dvh-4rem)] min-w-0 flex-col [--destination-width:calc(100vw-4rem)] md:ml-20 md:h-[calc(100dvh-3rem)] md:[--destination-width:calc(100vw-5rem)]">
            <a
                href="#atlas"
                onClick={(event) => {
                    event.preventDefault();
                    revealChapter("atlas", true);
                }}
                className="bg-background fixed top-4 left-20 z-50 -translate-y-24 px-5 py-3 focus:translate-y-0"
            >
                Skip to trending destinations
            </a>
            <nav
                aria-label="Destination navigation"
                className={`border-line bg-background text-foreground flex h-14 shrink-0 items-center justify-between gap-3 border-b px-4 transition-colors duration-500 motion-reduce:transition-none sm:px-8 ${navigationTheme}`}
            >
                <Link href="/discover" className="inline-flex min-h-11 items-center gap-2 text-xs">
                    <ArrowLeft size={14} strokeWidth={1} />
                    <span className="hidden sm:inline">Discover</span>
                    <span className="sm:hidden">Back</span>
                </Link>
                <span className="text-muted-foreground hidden text-[10px] tracking-widest uppercase lg:block">
                    {name}
                </span>
                <div className="flex gap-3 sm:gap-6" aria-label="Destination chapters">
                    {chapters.map((chapter) => (
                        <a
                            key={chapter.id}
                            href={`#${chapter.id}`}
                            aria-current={position.chapter === chapter.id ? "location" : undefined}
                            onClick={(event) => {
                                event.preventDefault();
                                revealChapter(chapter.id, true);
                            }}
                            className={`inline-flex min-h-11 items-center border-b text-[11px] sm:text-xs ${position.chapter === chapter.id ? "border-foreground" : "text-muted-foreground border-transparent"}`}
                        >
                            {chapter.label}
                        </a>
                    ))}
                </div>
            </nav>
            <motion.div
                ref={rail}
                layoutScroll
                role="region"
                aria-label={`${name} horizontal destination guide`}
                tabIndex={0}
                onKeyDown={(event) => {
                    if (
                        event.ctrlKey ||
                        event.altKey ||
                        event.metaKey ||
                        !(event.target instanceof Element) ||
                        event.target.closest(
                            "a, button, input, textarea, select, summary, dialog, [aria-roledescription=carousel]"
                        )
                    )
                        return;
                    if (["ArrowLeft", "ArrowRight", "PageUp", "PageDown", "Home", "End"].includes(event.key)) {
                        event.preventDefault();
                        if (event.key === "Home" || event.key === "End")
                            rail.current?.scrollTo({
                                left: event.key === "Home" ? 0 : rail.current.scrollWidth,
                                behavior: reduced ? "instant" : "smooth"
                            });
                        else move(event.key === "ArrowLeft" || event.key === "PageUp" ? -1 : 1);
                    }
                }}
                className="relative flex min-h-0 flex-1 [scrollbar-width:none] overflow-x-auto overflow-y-hidden overscroll-x-contain [overflow-anchor:none] focus-visible:outline-2 focus-visible:-outline-offset-2 [&::-webkit-scrollbar]:hidden"
            >
                {children}
            </motion.div>
            <footer
                className={`border-line bg-background text-foreground flex min-h-14 shrink-0 items-center gap-3 border-t px-4 transition-colors duration-500 motion-reduce:transition-none sm:gap-6 sm:px-8 ${navigationTheme}`}
            >
                <span className="text-muted-foreground hidden shrink-0 text-[10px] tracking-widest uppercase sm:block">
                    Scroll to explore
                </span>
                <button
                    type="button"
                    aria-label="Scroll guide left"
                    disabled={!position.previous}
                    onClick={() => move(-1)}
                    className="hover:bg-faint grid size-11 shrink-0 place-items-center disabled:opacity-25"
                >
                    <ArrowLeft size={20} strokeWidth={1} />
                </button>
                <input
                    aria-label="Position in destination guide"
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={position.progress}
                    onChange={(event) => {
                        const container = rail.current;
                        if (container)
                            container.scrollTo({
                                left:
                                    (Number(event.target.value) / 100) *
                                    (container.scrollWidth - container.clientWidth),
                                behavior: "instant"
                            });
                    }}
                    className="[&::-webkit-slider-runnable-track]:bg-line [&::-webkit-slider-thumb]:bg-foreground [&::-moz-range-track]:bg-line [&::-moz-range-thumb]:bg-foreground h-11 min-w-0 flex-1 cursor-ew-resize appearance-none bg-transparent [&::-moz-range-thumb]:h-[7px] [&::-moz-range-thumb]:w-9 [&::-moz-range-thumb]:rounded-none [&::-moz-range-thumb]:border-0 [&::-moz-range-track]:h-px [&::-webkit-slider-runnable-track]:h-px [&::-webkit-slider-thumb]:-mt-[3px] [&::-webkit-slider-thumb]:h-[7px] [&::-webkit-slider-thumb]:w-9 [&::-webkit-slider-thumb]:appearance-none"
                />
                <span
                    aria-hidden="true"
                    className="text-muted-foreground w-8 shrink-0 text-right text-[10px] tabular-nums"
                >
                    {String(position.progress).padStart(2, "0")}%
                </span>
                <button
                    type="button"
                    aria-label="Scroll guide right"
                    disabled={!position.next}
                    onClick={() => move(1)}
                    className="hover:bg-faint grid size-11 shrink-0 place-items-center disabled:opacity-25"
                >
                    <ArrowRight size={20} strokeWidth={1} />
                </button>
                <details className="relative shrink-0 text-xs">
                    <summary className="text-muted-foreground flex min-h-11 cursor-pointer list-none items-center [&::-webkit-details-marker]:hidden">
                        Credits
                    </summary>
                    <div className="border-line bg-background absolute right-0 bottom-[calc(100%+1rem)] z-40 max-h-[60dvh] w-[min(32rem,calc(100vw-5rem))] overflow-y-auto border p-6 text-xs leading-6 shadow-sm">
                        {credits}
                    </div>
                </details>
            </footer>
        </div>
    );
}
