import type { Metadata } from "next";

import BoardCreator from "@/components/features/boards/BoardCreator";
import AppShell from "@/components/layout/AppShell";
import { getStartingPlace } from "@/lib/destination-places";

export const metadata: Metadata = {
    title: "Create a new Board | Roamboard",
    description: "Build and preview a travel Board from photos, places, and activities."
};

export default async function NewBoardPage({
    searchParams
}: {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
    const params = await searchParams;

    return (
        <AppShell activeHref="/create">
            <BoardCreator
                backHref="/create"
                initialMode={params.mode === "scratch" ? "scratch" : "smart"}
                initialPlace={getStartingPlace(params)}
            />
        </AppShell>
    );
}
