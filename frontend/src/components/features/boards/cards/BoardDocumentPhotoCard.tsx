"use client";

import { useState, useSyncExternalStore } from "react";
import type { BoardDocument } from "@/lib/board-creator-api";
import { createBoardSaveStore } from "@/lib/board-save-store";
import { toPhotoBoardCard } from "@/lib/photo-board-card";
import PhotoBoardCard from "./PhotoBoardCard";

// Thin integration for a canonical document, with no fetching or workflow inside V4.
export default function BoardDocumentPhotoCard({ document }: { document: BoardDocument }) {
    return (
        <DocumentCard
            key={`${document.boardId}:${document.revision}:${document.permissions.canManageBoard}:${document.savedByMe}`}
            document={document}
        />
    );
}

function DocumentCard({ document }: { document: BoardDocument }) {
    const [store] = useState(() => createBoardSaveStore(document.boardId, document.savedByMe));
    const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
    const owner = document.permissions.canManageBoard;
    return (
        <PhotoBoardCard
            board={toPhotoBoardCard(document)}
            href={document.status === "draft" ? `/boards/drafts/${document.boardId}` : `/boards/${document.boardId}`}
            details
            ownership={owner ? "owner" : "other"}
            save={
                owner
                    ? undefined
                    : {
                          state: state.saved === undefined ? "unknown" : state.saved ? "saved" : "unsaved",
                          pending: state.pending,
                          onToggle: () => {
                              void store.toggle();
                          },
                          message: state.message,
                          error: state.error,
                          signInHref: state.signInRequired ? "/login" : undefined
                      }
            }
        />
    );
}
