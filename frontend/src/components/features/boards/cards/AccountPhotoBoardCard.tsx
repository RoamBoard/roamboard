"use client";

import { useState, useSyncExternalStore } from "react";
import { createBoardSaveStore, toggleBoardSave } from "@/lib/board-save-store";
import type { PhotoBoardCardData, PhotoBoardCardProps } from "@/types/board-card";
import PhotoBoardCard from "./PhotoBoardCard";

type Props = {
    board: PhotoBoardCardData;
    ownership: PhotoBoardCardProps["ownership"];
    href?: string;
    initialSaved?: boolean;
    onSavedChange?: (saved: boolean) => void;
};

// Local account integration shared by summaries and already-loaded documents. No metadata/membership requests.
export default function AccountPhotoBoardCard(props: Props) {
    return <AccountCard key={`${props.board.id}:${props.ownership}:${props.initialSaved}`} {...props} />;
}

function AccountCard({ board, ownership, href, initialSaved, onSavedChange }: Props) {
    const boardId = Number(board.id);
    const validId = /^\d+$/.test(board.id) && Number.isSafeInteger(boardId) && boardId > 0;
    const [store] = useState(() => createBoardSaveStore(boardId, initialSaved));
    const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
    return (
        <PhotoBoardCard
            board={board}
            href={href}
            details
            ownership={validId ? ownership : "unknown"}
            save={
                ownership === "other" && validId
                    ? {
                          state: state.saved === undefined ? "unknown" : state.saved ? "saved" : "unsaved",
                          pending: state.pending,
                          onToggle: () => {
                              void toggleBoardSave(store, onSavedChange);
                          },
                          message: state.message,
                          error: state.error,
                          signInHref: state.signInRequired ? "/login" : undefined
                      }
                    : undefined
            }
        />
    );
}
