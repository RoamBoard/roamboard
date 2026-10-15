"use client";

import { useCallback, useState, useTransition } from "react";
import Link from "next/link";
import { roamFlowBoards, roamFlowInitialPage } from "@/data/roamflow-boards";
import { loadRoamFlowPage, type RoamFlowPage, type RoamFlowSource } from "@/lib/roamflow";
import RoamFlow from "./RoamFlow";

const stressPage: RoamFlowPage = {
    boards: Array.from({ length: 1000 }, (_, index) => ({
        ...roamFlowBoards[index % roamFlowBoards.length],
        id: `stress-story-${index}`,
        title: `Stress story ${index + 1}`,
        titleLines: ["Stress story", String(index + 1)],
        href: undefined
    })),
    nextCursor: null
};
const emptyPage: RoamFlowPage = { boards: [], nextCursor: null };

export default function RoamFlowLab() {
    const [mode, setMode] = useState("preview");
    const [preparing, startTransition] = useTransition();
    const [failRequests, setFailRequests] = useState(false);
    const source: RoamFlowSource = useCallback(
        async (cursor, signal) => {
            // A slow source makes the pending state, duplicate guards, and cancellation observable.
            await new Promise<void>((resolve, reject) => {
                const onAbort = () => {
                    clearTimeout(timer);
                    reject(new DOMException("Cancelled", "AbortError"));
                };
                const timer = setTimeout(() => {
                    signal.removeEventListener("abort", onAbort);
                    resolve();
                }, 900);
                signal.addEventListener("abort", onAbort, { once: true });
            });
            signal.throwIfAborted();
            if (mode === "error" && failRequests) {
                throw new Error("Intentional request failure in the RoamFlow lab");
            }
            return loadRoamFlowPage(cursor, signal);
        },
        [mode, failRequests]
    );
    return (
        <main className="bg-black text-white">
            <header className="font-body flex flex-wrap items-center gap-5 border-b border-white/25 px-6 py-5">
                <h1 className="font-display text-24 font-bold">RoamFlow lab</h1>
                <label className="text-14 flex items-center gap-3">
                    Scenario
                    <select
                        value={mode}
                        onChange={(event) => {
                            const nextMode = event.target.value;
                            startTransition(() => {
                                setFailRequests(nextMode === "error");
                                setMode(nextMode);
                            });
                        }}
                        className="min-h-11 border border-white/40 bg-black px-3 focus-visible:outline-2"
                    >
                        <option value="preview">Progressive loading (slow source)</option>
                        <option value="error">Request failure and retry</option>
                        <option value="empty">Empty collection</option>
                        <option value="reduced">Reduced motion</option>
                        <option value="stress">1,000 preloaded stress cards</option>
                    </select>
                </label>
                {preparing && <p role="status">Preparing gallery…</p>}
                {mode === "error" && (
                    <button
                        type="button"
                        onClick={() => setFailRequests(!failRequests)}
                        className="text-14 min-h-11 border border-white/40 px-4 focus-visible:outline-2"
                    >
                        {failRequests ? "Allow requests to succeed" : "Make requests fail"}
                    </button>
                )}
                <Link href="/discover#roamflow" className="text-14 inline-flex min-h-11 items-center underline">
                    Discover preview ↗
                </Link>
                <p className="text-12 w-full text-white/60">
                    Developer fixtures only. Stress cards intentionally reuse photos; they are never included in
                    Discover. A slow source is used here to inspect loading and cancellation.
                </p>
            </header>
            <RoamFlow
                key={mode}
                initialPage={mode === "stress" ? stressPage : mode === "empty" ? emptyPage : roamFlowInitialPage}
                source={source}
                reduceMotion={mode === "reduced"}
            />
            <footer className="px-6 py-12">
                <a href="#roamflow" className="inline-flex min-h-11 items-center underline focus-visible:outline-2">
                    Footer reached · return to RoamFlow
                </a>
            </footer>
        </main>
    );
}
