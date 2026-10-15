import type { Metadata } from "next";
import MyBoardsExperience from "@/components/features/boards/MyBoardsExperience";
import AppShell from "@/components/layout/AppShell";

export const metadata: Metadata = {
    title: "Boards | Roamboard",
    description: "Revisit and explore your travel Boards."
};

export default function BoardsPage() {
    return (
        <AppShell activeHref="/boards">
            <MyBoardsExperience />
        </AppShell>
    );
}
