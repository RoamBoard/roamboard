import { notFound } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import BoardCollectionsLab from "@/components/features/boards/BoardCollectionsLab";

export const metadata = { title: "Board collections review | Roamboard", robots: { index: false, follow: false } };
export default function BoardCollectionsReviewPage() {
    if (process.env.NODE_ENV !== "development") notFound();
    return (
        <AppShell activeHref="/boards">
            <BoardCollectionsLab />
        </AppShell>
    );
}
