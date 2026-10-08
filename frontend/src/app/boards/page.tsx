import type { Metadata } from "next";
import AppShell from "@/components/layout/AppShell";

export const metadata: Metadata = {
    title: "Boards | Roamboard"
};

export default function BoardsPage() {
    return (
        <AppShell activeHref="/boards">
            <div className="grid place-items-center text-center">
                <div>
                    <h1 className="font-display text-24">Boards</h1>
                    <p className="font-body text-14 text-muted-foreground mt-2">
                        This page is a placeholder.
                    </p>
                </div>
            </div>
        </AppShell>
    );
}
