"use client";

import type { BoardDocument } from "@/lib/board-creator-api";
import { toPhotoBoardCard } from "@/lib/photo-board-card";
import AccountPhotoBoardCard from "./AccountPhotoBoardCard";

// Reuses the same account integration as summary cards, without fetching a document for presentation.
export default function BoardDocumentPhotoCard({ document }: { document: BoardDocument }) {
    return (
        <AccountPhotoBoardCard
            key={`${document.boardId}:${document.revision}`}
            board={toPhotoBoardCard(document)}
            ownership={document.permissions.canManageBoard ? "owner" : "other"}
            initialSaved={document.savedByMe}
            href={document.status === "draft" ? `/boards/drafts/${document.boardId}` : `/boards/${document.boardId}`}
        />
    );
}
