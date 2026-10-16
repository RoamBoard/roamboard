import type { Metadata } from "next";
import { notFound } from "next/navigation";
import DatabasePublishedBoard from "@/components/features/boards/DatabasePublishedBoard";
import PublishedBoard from "@/components/features/boards/PublishedBoard";
import PublishedBoardShell from "@/components/features/boards/PublishedBoardShell";
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
            title: "Board | Roamboard",
            description: "View a published Roamboard Board.",
            robots: { index: false, follow: false }
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

    // Every database ID uses the same live viewer, including newly published Boards.
    if (isDatabaseBoardId(boardId)) {
        return <DatabasePublishedBoard key={boardId} boardId={boardId} />;
    }

    const data = await getPublishedBoard(boardId);
    if (!data) notFound();

    return (
        <PublishedBoardShell>
            <PublishedBoard {...data} />
        </PublishedBoardShell>
    );
}
