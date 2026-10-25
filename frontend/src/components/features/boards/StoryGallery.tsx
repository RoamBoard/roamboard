"use client";

import { useEffect, useRef } from "react";
import ImageZoomDialog from "@/components/ui/ImageZoomDialog";
import type { BoardImage } from "@/types/board";

export type StoryPlacement = { id: string; image: BoardImage };

export default function StoryGallery({
    placements,
    initialIndex,
    onClose
}: {
    placements: StoryPlacement[];
    initialIndex: number;
    onClose: () => void;
}) {
    const dialog = useRef<HTMLDialogElement>(null);
    useEffect(() => {
        const target = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        const position = window.scrollY;
        dialog.current?.showModal();
        return () => {
            window.scrollTo({ top: position, behavior: "instant" });
            target?.focus({ preventScroll: true });
        };
    }, []);
    // The native top layer also works when opened above an activity-details dialog.
    return (
        <dialog
            ref={dialog}
            aria-label="Board photo gallery"
            onCancel={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onClose();
            }}
            className="fixed inset-0 m-0 h-dvh max-h-none w-screen max-w-none border-0 bg-transparent p-0 backdrop:bg-transparent"
        >
            <ImageZoomDialog
                images={placements.map((placement) => placement.image)}
                initialIndex={initialIndex}
                onClose={onClose}
            />
        </dialog>
    );
}
