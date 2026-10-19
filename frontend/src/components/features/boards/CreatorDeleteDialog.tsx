"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { deleteBoard } from "@/lib/boards";

export default function CreatorDeleteDialog({
    boardId,
    onClose,
    onDeletingChange
}: {
    boardId: number;
    onClose: () => void;
    onDeletingChange: (deleting: boolean) => void;
}) {
    const router = useRouter();
    const inFlight = useRef(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function confirmDelete() {
        if (inFlight.current) return;
        inFlight.current = true;
        setLoading(true);
        setError(null);
        onDeletingChange(true);
        try {
            await deleteBoard(boardId);
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "The Board could not be deleted.");
            inFlight.current = false;
            setLoading(false);
            onDeletingChange(false);
            return;
        }
        router.replace("/boards");
    }

    return (
        <ConfirmDialog
            title="Delete this Board?"
            description="Are you sure you want to permanently delete this Board and all its activities? This cannot be undone."
            confirmLabel="Delete Board"
            error={error}
            loading={loading}
            onCancel={() => {
                if (!inFlight.current) onClose();
            }}
            onConfirm={() => void confirmDelete()}
        />
    );
}
