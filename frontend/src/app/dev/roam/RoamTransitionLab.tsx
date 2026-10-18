"use client";

import Link from "next/link";
import { useDestinationTransition } from "@/components/features/destinations/DestinationTransitionProvider";

export default function RoamTransitionLab({ complete }: { complete: boolean }) {
    const transition = useDestinationTransition();
    return (
        <section className="font-body grid min-h-dvh place-content-center gap-6 px-8">
            <p className="text-muted-foreground text-xs">DEVELOPMENT ONLY · CONTROLLED TRANSITION TESTS</p>
            <h1 className="font-display text-3xl">{complete ? "The test page is ready." : "Roam transition lab"}</h1>
            <p className="text-muted-foreground max-w-lg text-sm leading-relaxed">
                Slow waits seven seconds for the server-rendered page. Failure throws at the same readiness boundary.
                Neither scenario changes production fetching. The line-only composition intentionally has no destination
                photography.
            </p>
            <div className="flex flex-wrap gap-6 text-sm">
                {[
                    ["Fast", "fast"],
                    ["Slow", "slow"],
                    ["Failure", "failed"]
                ].map(([label, scenario]) => (
                    <button
                        key={scenario}
                        type="button"
                        className="min-h-11 underline underline-offset-4 focus-visible:outline-2"
                        onClick={() => transition?.open(`/dev/roam?scenario=${scenario}`, "destination")}
                    >
                        {label}
                    </button>
                ))}
                <button
                    type="button"
                    className="min-h-11 underline underline-offset-4 focus-visible:outline-2"
                    onClick={() =>
                        transition?.open("/discover/destinations/unknown-destination", "unknown destination")
                    }
                >
                    Unknown destination
                </button>
            </div>
            <Link href="/home" className="min-h-11 text-sm underline underline-offset-4 focus-visible:outline-2">
                Return to Roam
            </Link>
        </section>
    );
}
