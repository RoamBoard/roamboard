import { notFound } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import CreatorPreviewLab from "@/components/features/boards/CreatorPreviewLab";

export const metadata = { title: "Creator preview review | Roamboard", robots: { index: false, follow: false } };

export default function CreatorPreviewReviewPage() {
    if (process.env.NODE_ENV !== "development") notFound();
    return (
        <AppShell activeHref="/create">
            <CreatorPreviewLab />
        </AppShell>
    );
}
