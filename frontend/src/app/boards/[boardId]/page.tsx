import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PublishedBoard from "@/components/features/boards/PublishedBoard";
import PublishedBoardShell from "@/components/features/boards/PublishedBoardShell";
import PublishedBoardView from "@/components/features/boards/PublishedBoardView";
import AppShell from "@/components/layout/AppShell";
import { getPublishedBoard } from "@/lib/published-board";

type Props = {
    params: Promise<{ boardId: string }>;
};

function isDatabaseBoardId(boardId: string) {
    return /^[1-9]\d*$/.test(boardId);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { boardId } = await params;

    if (isDatabaseBoardId(boardId)) {
        return {
            title: "Board inspector | Roamboard",
            description: "Inspect a saved Roamboard Board."
        };
    }

    const data = await getPublishedBoard(boardId);

    return {
        title: data ? `${data.board.title} | Roamboard` : "Board not found | Roamboard",
        description: data?.board.description,
        robots: { index: false, follow: false }
    };
}

export default async function BoardPage({ params }: Props) {
    const { boardId } = await params;

    // Saved boards use the existing backend viewer.
    if (isDatabaseBoardId(boardId)) {
        return (
            <AppShell activeHref="/boards">
                <PublishedBoardView boardId={boardId} />
            </AppShell>
        );
    }

    const data = await getPublishedBoard(boardId);
    if (!data) notFound();

    return (
        <PublishedBoardShell>
            <PublishedBoard {...data} />
        </PublishedBoardShell>
    );
}
