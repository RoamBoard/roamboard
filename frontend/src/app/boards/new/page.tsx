import type { Metadata } from "next";

import BoardCreator from "@/components/features/boards/BoardCreator";
import AppShell from "@/components/layout/AppShell";

export const metadata: Metadata = {
    title: "Create a new Board | Roamboard",
    description: "Build and preview a travel Board from photos, places, and activities."
};

export default async function NewBoardPage({ searchParams }: { searchParams: Promise<{ mode?: string | string[] }> }) {
    const { mode } = await searchParams;
    return (
        <AppShell activeHref="/create">
            <BoardCreator initialMode={mode === "scratch" ? "scratch" : "smart"} />
        </AppShell>
    );
}
