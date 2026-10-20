"use client";

import { useEffect, useState } from "react";
import { loadBoardDocument, type BoardDocument } from "@/lib/board-creator-api";
import { toPhotoBoardCard } from "@/lib/photo-board-card";
import type { PhotoBoardCardProps } from "@/types/board-card";
import AccountPhotoBoardCard from "@/components/features/boards/cards/AccountPhotoBoardCard";

// Only the selected destination Board needs a document. Summary cards remain usable on failure.
export default function DestinationStoryCard(props: PhotoBoardCardProps) {
    const [document, setDocument] = useState<BoardDocument>();
    const [failed, setFailed] = useState(false);
    const [attempt, setAttempt] = useState(0);
    const active = Boolean(props.selection?.selected);
    const boardId = Number(props.board.id);
    useEffect(() => {
        if (!active || document) return;
        const controller = new AbortController();
        loadBoardDocument(boardId, controller.signal)
            .then((loaded) => {
                if (controller.signal.aborted) return;
                if (loaded.boardId !== boardId) throw new Error("Board identity changed");
                setDocument(loaded);
                setFailed(false);
            })
            .catch(() => {
                if (!controller.signal.aborted) setFailed(true);
            });
        return () => controller.abort();
    }, [active, boardId, document, attempt]);
    const owner = document?.permissions.canManageBoard;
    return (
        <>
            <AccountPhotoBoardCard
                tilt
                showVisibility
                board={document ? { ...toPhotoBoardCard(document), labelOffset: props.board.labelOffset } : props.board}
                ownership={document ? (owner ? "owner" : "other") : "unknown"}
                initialSaved={document?.savedByMe}
                details={props.details}
                selection={props.selection}
                imageSizes={props.imageSizes}
                galleryCover={props.galleryCover}
                hideCoverCredit
                suppressHover={props.suppressHover}
                hoverActions={
                    active
                        ? {
                              editHref:
                                  owner && document.permissions.canEditContent ? `/boards/${boardId}/edit` : undefined,
                              viewHref: `/boards/${boardId}`
                          }
                        : undefined
                }
            />
            {active && failed && (
                <button
                    type="button"
                    onClick={() => {
                        setFailed(false);
                        setAttempt(attempt + 1);
                    }}
                    className="bg-background absolute bottom-2 left-2 z-30 min-h-11 px-3 text-xs underline"
                >
                    Retry Board details
                </button>
            )}
        </>
    );
}
