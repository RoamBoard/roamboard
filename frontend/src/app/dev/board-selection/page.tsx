import { notFound } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import BoardSelectionLab from "@/components/features/boards/BoardSelectionLab";

export const metadata = { title: "Board selection review | Roamboard", robots: { index: false, follow: false } };

export default function BoardSelectionReviewPage() {
    if (process.env.NODE_ENV !== "development") notFound();
    return (
        <AppShell activeHref="/create">
            <BoardSelectionLab />
        </AppShell>
    );
}
