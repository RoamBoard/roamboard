"use client";

import { memo, useEffect, useRef } from "react";
import { loadRoamFlowPage, type RoamFlowPage, type RoamFlowSource } from "@/lib/roamflow";
import RoamFlowGallery from "./RoamFlowGallery";
import { useRoamFlow } from "./useRoamFlow";

type Props = { initialPage: RoamFlowPage; source?: RoamFlowSource; reduceMotion?: boolean };
const button =
    "text-14 inline-flex min-h-11 items-center justify-center gap-8 border border-white/40 px-6 py-3 text-white transition-colors hover:border-white hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white disabled:cursor-wait disabled:text-white/50 motion-reduce:transition-none";
const textLink =
    "text-12 inline-flex min-h-11 items-center underline decoration-white/35 underline-offset-4 hover:decoration-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white";
const MemoRoamFlowGallery = memo(RoamFlowGallery);

export default function RoamFlow({ initialPage, source = loadRoamFlowPage, reduceMotion = false }: Props) {
    const { boards, nextCursor, status, loadMore } = useRoamFlow(initialPage, source);
    const sentinel = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!sentinel.current || status !== "idle" || nextCursor === null) return;
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (!entry.isIntersecting) return;
                observer.disconnect();
                void loadMore();
            },
            { rootMargin: "2400px 0px" }
        );
        observer.observe(sentinel.current);
        return () => observer.disconnect();
    }, [status, nextCursor, loadMore]);

    return (
        <section
            id="roamflow"
            aria-labelledby="roamflow-title"
            className="font-body scroll-mt-6 bg-black px-5 pt-10 pb-14 text-white md:px-10 md:pt-14 md:pb-20"
        >
            <header className="border-t border-white/25 pt-7">
                <div className="flex flex-col-reverse justify-between gap-8 md:flex-row md:gap-12">
                    <div className="max-w-60 md:pt-2">
                        <p className="text-10 mb-4 tracking-[.16em] text-white/50 uppercase">Roam with the flow</p>
                        <p className="font-display text-24 leading-tight text-white/80">Just keep scrolling.</p>
                    </div>
                    <div className="self-end text-right md:self-start">
                        <p className="font-display text-14 md:text-20 mb-2 font-light text-white/70">Introducing</p>
                        <h2
                            id="roamflow-title"
                            className="font-display text-[clamp(3rem,7vw,6rem)] leading-none font-bold tracking-[-.025em]"
                        >
                            RoamFlow
                        </h2>
                    </div>
                </div>
                <p className="text-10 mt-7 text-white/45">Explore public travel Boards from the Roamboard community.</p>
            </header>

            <div className="mt-10 md:mt-4">
                <MemoRoamFlowGallery boards={boards} reduceMotion={reduceMotion} />
            </div>

            <div ref={sentinel} aria-hidden="true" className="h-px" />
            {status === "loading" && (
                <p role="status" className="text-14 mt-8 text-white/60">
                    Loading more Boards…
                </p>
            )}
            {status === "error" && (
                <div role="alert" className="mt-8 flex flex-wrap items-center gap-5">
                    <p className="text-14 text-white/60">Couldn’t load more Boards.</p>
                    <button type="button" onClick={() => void loadMore()} className={button}>
                        Try again
                    </button>
                </div>
            )}
            {boards.length === 0 && nextCursor === null && status !== "error" && (
                <p role="status" className="text-14 mt-8 text-white/60">
                    No public Boards yet.
                </p>
            )}
            <div className="mt-16 border-t border-white/20 pt-5 md:mt-24">
                <a href="#roamflow" className={`${textLink} text-white/60`}>
                    Back to RoamFlow ↑
                </a>
            </div>
        </section>
    );
}
