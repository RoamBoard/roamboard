import type { Metadata } from "next";
import Link from "next/link";
import AppShell from "@/components/layout/AppShell";

export const metadata: Metadata = {
    title: "Boards | Roamboard"
};

// The board list is still a placeholder with a link to the published sample.
export default function BoardsPage() {
    return (
        <AppShell activeHref="/boards">
            <div className="grid place-items-center text-center">
                <div>
                    <h1 className="font-display text-24">Boards</h1>
                    <p className="font-body text-14 text-muted-foreground mt-2">
                        This page is a placeholder.
                    </p>
                    <Link
                        href="/boards/lost-in-tokyo"
                        className="text-14 mt-5 inline-block py-2 underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4"
                    >
                        View published board preview
                    </Link>
                </div>
            </div>
        </AppShell>
    );
}
