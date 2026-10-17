import type { Metadata } from "next";
import AppShell from "@/components/layout/AppShell";
import BoardSelectionExperience from "@/components/features/boards/BoardSelectionExperience";

export const metadata: Metadata = { title: "Continue a Board | Roamboard", robots: { index: false, follow: false } };
export default function ContinueBoardPage() {
    return (
        <AppShell activeHref="/create">
            <BoardSelectionExperience mode="continue" />
        </AppShell>
    );
}
