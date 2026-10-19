import type { Metadata } from "next";
import AppShell from "@/components/layout/AppShell";
import BoardSelectionExperience from "@/components/features/boards/BoardSelectionExperience";

export const metadata: Metadata = { title: "Remix a saved Board | Roamboard", robots: { index: false, follow: false } };
export default function RemixBoardPage() {
    return (
        <AppShell activeHref="/create" backHref="/create">
            <BoardSelectionExperience mode="remix" />
        </AppShell>
    );
}
