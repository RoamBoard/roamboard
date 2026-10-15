import type { Metadata } from "next";
import AppShell from "@/components/layout/AppShell";

export const metadata: Metadata = {
    title: "Boards | Roamboard",
    description: "Your Roamboard Boards page is coming soon."
};

export default function BoardsPage() {
    return (
        <AppShell activeHref="/boards">
            <section className="grid min-h-full place-content-center gap-4 px-5 py-24 text-center">
                <h1 className="font-display text-48 font-bold">Boards</h1>
                <p className="text-muted-foreground text-14">The Boards page is awaiting implementation.</p>
            </section>
        </AppShell>
    );
}
