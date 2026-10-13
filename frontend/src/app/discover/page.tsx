import type { Metadata } from "next";
import AppShell from "@/components/layout/AppShell";

export const metadata: Metadata = {
    title: "Discover | Roamboard"
};

export default function DiscoverPage() {
    return (
        <AppShell activeHref="/discover">
            <div className="grid place-items-center text-center">
                <div>
                    <h1 className="font-display text-24">Discover</h1>
                    <p className="font-body text-14 text-muted-foreground mt-2">
                        This page is a placeholder.
                    </p>
                </div>
            </div>
        </AppShell>
    );
}
