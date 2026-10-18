import Link from "next/link";
import AppShell from "@/components/layout/AppShell";
import { DestinationReady } from "@/components/features/destinations/DestinationTransitionProvider";

export default function DestinationNotFound() {
    return (
        <AppShell activeHref="/discover">
            <DestinationReady />
            <section className="font-body grid min-h-dvh place-content-center gap-5 px-8 text-center">
                <p className="text-muted-foreground text-xs">404</p>
                <h1 className="font-display text-3xl">A little further off the map.</h1>
                <p className="text-muted-foreground max-w-sm text-sm leading-relaxed">
                    We don’t have a destination page for this place yet.
                </p>
                <Link
                    href="/home"
                    className="min-h-11 py-3 text-sm underline underline-offset-4 focus-visible:outline-2"
                >
                    Return to search
                </Link>
            </section>
        </AppShell>
    );
}
