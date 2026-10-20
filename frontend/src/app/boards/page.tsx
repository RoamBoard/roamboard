import type { Metadata } from "next";
import { Suspense } from "react";
import BoardsDiscovery from "@/components/features/boards/BoardsDiscovery";
import AppShell from "@/components/layout/AppShell";

export const metadata: Metadata = {
    title: "Boards | Roamboard",
    description: "Search and explore travel Boards shared by the community."
};

export default function BoardsPage() {
    return (
        <AppShell activeHref="/boards">
            <Suspense
                fallback={
                    <p role="status" className="p-12 text-center">
                        Loading Boards…
                    </p>
                }
            >
                <BoardsDiscovery />
            </Suspense>
        </AppShell>
    );
}
