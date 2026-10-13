import type { Metadata } from "next";

import PublishedBoardList from "@/components/features/boards/PublishedBoardList";
import AppShell from "@/components/layout/AppShell";

export const metadata: Metadata = {
    title: "My Boards | Roamboard"
};

export default function MyBoardsPage() {
    return (
        <AppShell activeHref="/boards">
            <PublishedBoardList />
        </AppShell>
    );
}
