"use client";

import { useEffect, useRef, useState } from "react";
import { loadRoamFlowPage, type RoamFlowPage, type RoamFlowSource } from "@/lib/roamflow";
import RoamFlowGallery from "./RoamFlowGallery";
import { useRoamFlow } from "./useRoamFlow";

type Props = { initialPage: RoamFlowPage; source?: RoamFlowSource; reduceMotion?: boolean };
const button =
    "text-14 inline-flex min-h-11 items-center justify-center gap-8 border border-white/40 px-6 py-3 text-white transition-colors hover:border-white hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white disabled:cursor-wait disabled:text-white/50 motion-reduce:transition-none";
const textLink =
    "text-12 inline-flex min-h-11 items-center underline decoration-white/35 underline-offset-4 hover:decoration-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white";

export default function RoamFlow({ initialPage, source = loadRoamFlowPage, reduceMotion = false }: Props) {
    const { boards, nextCursor, status, loadMore, cancel } = useRoamFlow(initialPage, source);
    const [automaticPages, setAutomaticPages] = useState(2);
    const sentinel = useRef<HTMLDivElement>(null);
    const manualStart = useRef<number | null>(null);

    useEffect(() => {
        const index = manualStart.current;
        if (index === null || boards.length <= index) return;
        // Allow Discover's ResizeObserver to extend its scroll track before moving to new content.
        // This only follows an explicit load/retry action, never an automatic page load.
        const pending = { frame: 0 };
        pending.frame = requestAnimationFrame(() => {
            pending.frame = requestAnimationFrame(() => {
                if (manualStart.current !== index) return;
                manualStart.current = null;
                const story = document.getElementById(`roamflow-story-${boards[index].id}`);
                story?.focus({ preventScroll: true });
                story?.scrollIntoView({ block: "start", behavior: "instant" });
            });
        });
        return () => cancelAnimationFrame(pending.frame);
    }, [boards]);

    useEffect(() => {
        if (!sentinel.current || !automaticPages || status !== "idle" || nextCursor === null) return;
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (!entry.isIntersecting) return;
                observer.disconnect();
                setAutomaticPages((remaining) => Math.max(0, remaining - 1));
                void loadMore();
            },
            { rootMargin: "400px 0px" }
        );
        observer.observe(sentinel.current);
        return () => observer.disconnect();
    }, [automaticPages, status, nextCursor, loadMore]);

    function skipGallery() {
        manualStart.current = null;
        setAutomaticPages(0);
        cancel();
    }

    return (
        <section
            id="roamflow"
            aria-labelledby="roamflow-title"
            className="font-body scroll-mt-6 bg-black px-5 pt-10 pb-14 text-white md:px-10 md:pt-14 md:pb-20"
        >
            <header className="border-t border-white/25 pt-7">
                <div className="flex flex-col-reverse justify-between gap-8 md:flex-row md:gap-12">
                    <div className="max-w-60 md:pt-2">
                        <p className="text-10 mb-4 tracking-[.16em] text-white/50 uppercase">Follow your curiosity</p>
                        <p className="font-display text-24 leading-tight text-white/80">
                            For the places you didn’t plan to find.
                        </p>
                    </div>
                    <div className="self-end text-right md:self-start">
                        <p className="font-display text-14 md:text-20 mb-2 font-light text-white/70">Introducing</p>
                        <h2
                            id="roamflow-title"
                            className="font-display text-[clamp(3rem,7vw,6rem)] leading-none font-bold tracking-[-.025em]"
                        >
                            RoamFlow
                        </h2>
                        <a href="#roamflow-end" onClick={skipGallery} className={`${textLink} mt-3 text-white/55`}>
                            Skip gallery{" "}
                            <span aria-hidden="true" className="ml-3">
                                ↓
                            </span>
                        </a>
                    </div>
                </div>
                <p className="text-10 mt-7 text-white/45">Explore public travel Boards from the Roamboard community.</p>
            </header>

            <div className="mt-10 md:mt-4">
                <RoamFlowGallery boards={boards} reduceMotion={reduceMotion} />
            </div>

            <div ref={sentinel} aria-hidden="true" className="h-px" />
            <div className="mt-16 border-t border-white/20 pt-8 md:mt-24">
                <p role="status" aria-live="polite" aria-atomic="true" className="text-14 min-h-6 text-white/60">
                    {status === "loading"
                        ? "Finding your next stories…"
                        : status === "error"
                          ? "The next stories couldn’t load. Your current stories are still here."
                          : boards.length === 0
                            ? "A little quiet here. New stories will find their way here soon."
                            : nextCursor === null
                              ? "You’ve reached the end of this collection. The next journey is yours."
                              : `${boards.length} stories, and a few more paths to follow.`}
                </p>
                <div className="mt-5 flex flex-wrap items-center gap-x-8 gap-y-3">
                    {nextCursor !== null && (
                        <button
                            type="button"
                            disabled={status === "loading"}
                            onClick={() => {
                                manualStart.current = boards.length;
                                setAutomaticPages(2);
                                void loadMore();
                            }}
                            className={button}
                        >
                            {status === "loading"
                                ? "Loading stories…"
                                : status === "error"
                                  ? "Try again"
                                  : "Keep exploring"}
                            <span aria-hidden="true">{status === "loading" ? "· · ·" : "+"}</span>
                        </button>
                    )}
                    <a href="#roamflow-end" onClick={skipGallery} className={`${textLink} text-white/60`}>
                        Continue to page footer{" "}
                        <span aria-hidden="true" className="ml-3">
                            ↓
                        </span>
                    </a>
                    <a href="#roamflow" className={`${textLink} text-white/60`}>
                        Back to RoamFlow ↑
                    </a>
                </div>
            </div>
            <div id="roamflow-end" tabIndex={-1} aria-label="End of RoamFlow" className="scroll-mt-6 outline-none" />
        </section>
    );
}
