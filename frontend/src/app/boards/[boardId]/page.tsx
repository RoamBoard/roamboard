import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PublishedBoard from "@/components/features/boards/PublishedBoard";
import PublishedBoardShell from "@/components/features/boards/PublishedBoardShell";
import { getPublishedBoard } from "@/lib/published-board";

type Props = { params: Promise<{ boardId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { boardId } = await params;
    const data = await getPublishedBoard(boardId);
    return {
        title: data
            ? `${data.board.title} | Roamboard`
            : "Board not found | Roamboard",
        description: data?.board.description,
        // Mock content should not be indexed. Revisit when the public API is live.
        robots: { index: false, follow: false }
    };
}

export default async function PublishedBoardPage({ params }: Props) {
    const { boardId } = await params;
    const data = await getPublishedBoard(boardId);
    if (!data) notFound();

    return (
        <PublishedBoardShell>
            <PublishedBoard {...data} />
        </PublishedBoardShell>
    );
}
