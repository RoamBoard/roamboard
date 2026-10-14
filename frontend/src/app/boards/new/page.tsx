import type { Metadata } from "next";

import BoardCreator from "@/components/features/boards/BoardCreator";
import AppShell from "@/components/layout/AppShell";

export const metadata: Metadata = {
    title: "Create a new Board | Roamboard",
    description:
        "Build and preview a travel Board from photos, places, and activities."
};

export default function NewBoardPage() {
    return (
        <AppShell activeHref="/boards">
            <BoardCreator />
        </AppShell>
    );
}
