"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import BoardCreationPreview from "@/components/features/boards/BoardCreationPreview";
import {
    fromBoardDocument,
    loadBoardDocument,
    type BoardDocument
} from "@/lib/board-creator-api";
import type { BoardCreatorPayload } from "@/types/board-creator";

export default function PublishedBoardView({ boardId }: { boardId: string }) {
    const [board, setBoard] = useState<BoardDocument | null>(null);
    const [error, setError] = useState("");

    useEffect(() => {
        void loadBoardDocument(Number(boardId))
            .then(setBoard)
            .catch((caught: unknown) =>
                setError(
                    caught instanceof Error
                        ? caught.message
                        : "The Board could not be loaded."
                )
            );
    }, [boardId]);

    if (error)
        return (
            <div className="px-6 py-20 sm:px-12">
                <p className="text-10 tracking-label text-stone uppercase">
                    Board inspector
                </p>
                <h1 className="font-display text-48 mt-4 font-bold">
                    Could not load Board
                </h1>
                <p className="text-14 text-graphite mt-4" role="alert">
                    {error}
                </p>
            </div>
        );
    if (!board)
        return (
            <div
                className="text-13 text-graphite grid min-h-[70dvh] place-items-center"
                role="status"
            >
                Loading Board…
            </div>
        );

    const restored = fromBoardDocument(board);
    const preview: BoardCreatorPayload = {
        title: board.title,
        description: board.description ?? "",
        status: board.status,
        visibility: board.visibility,
        coverImageId: board.coverImageId,
        tags: board.tags.map((tag) => tag.name),
        days: restored.days,
        images: restored.images
    };

    return (
        <article className="px-5 py-16 sm:px-10 lg:px-16">
            <header className="border-line mx-auto max-w-7xl border-b pb-10">
                <p className="text-10 tracking-label text-stone font-bold uppercase">
                    Saved Board inspector · {board.status}
                </p>
                <h1 className="font-display text-48 sm:text-72 mt-4 leading-none font-bold">
                    {board.title || "Untitled Board"}
                </h1>
                <p className="text-11 text-graphite mt-4 break-all">
                    Board ID: {board.boardId}
                </p>
                {board.status === "published" &&
                board.permissions.canEditContent ? (
                    <Link
                        href={`/boards/${board.boardId}/edit`}
                        className="border-foreground text-14 mt-7 inline-block border px-6 py-3"
                    >
                        Edit Board
                    </Link>
                ) : null}
            </header>
            <div className="mx-auto mt-12 max-w-7xl">
                <BoardCreationPreview board={preview} />
            </div>
        </article>
    );
}
