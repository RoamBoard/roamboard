"use client";

import Link from "next/link";
import AppShell from "@/components/layout/AppShell";
import { DestinationFailed } from "@/components/features/destinations/DestinationTransitionProvider";

export default function DestinationError({ reset }: { reset: () => void }) {
    return (
        <AppShell activeHref="/discover">
            <DestinationFailed reset={reset} />
            <section className="font-body grid min-h-dvh place-content-center gap-5 px-8 text-center">
                <h1 className="font-display text-3xl">This destination couldn’t be opened.</h1>
                <p className="text-muted-foreground text-sm">Please try again in a moment.</p>
                <button
                    type="button"
                    onClick={reset}
                    className="min-h-11 text-sm underline underline-offset-4 focus-visible:outline-2"
                >
                    Try again
                </button>
                <Link
                    href="/home"
                    className="text-muted-foreground min-h-11 py-3 text-sm underline underline-offset-4 focus-visible:outline-2"
                >
                    Return to search
                </Link>
            </section>
        </AppShell>
    );
}
