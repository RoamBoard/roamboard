"use client";

import {
    useEffect,
    useId,
    useRef,
    type MouseEvent,
    type ReactNode
} from "react";
import { motion, useReducedMotion } from "motion/react";
import BoardIcon from "@/components/features/boards/BoardIcon";

type Props = {
    title: string;
    onClose: () => void;
    children: ReactNode;
};

export default function BoardDialog({ title, onClose, children }: Props) {
    const dialogRef = useRef<HTMLDialogElement>(null);
    const titleId = useId();
    const reducedMotion = useReducedMotion();

    function handleBackdropClick(event: MouseEvent<HTMLDialogElement>) {
        if (event.target === event.currentTarget) onClose();
    }

    useEffect(() => {
        const dialog = dialogRef.current;
        const previousOverflow = document.body.style.overflow;
        dialog?.showModal();
        document.body.style.overflow = "hidden";
        return () => {
            dialog?.close();
            document.body.style.overflow = previousOverflow;
        };
    }, []);

    return (
        <dialog
            ref={dialogRef}
            aria-labelledby={titleId}
            onCancel={onClose}
            onClick={handleBackdropClick}
            className="bg-background text-foreground border-line fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-3xl overflow-y-auto border p-0 backdrop:bg-black/45"
        >
            <motion.div
                initial={{ opacity: 0, y: reducedMotion ? 0 : 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: reducedMotion ? 0 : 0.2 }}
                className="p-5 sm:p-9"
            >
                <header className="mb-6 flex items-start justify-between gap-4">
                    <h2 id={titleId} className="font-display text-30 font-bold">
                        {title}
                    </h2>
                    <button
                        type="button"
                        aria-label="Close dialog"
                        onClick={onClose}
                        className="border-line hover:bg-faint shrink-0 cursor-pointer border p-2 focus-visible:outline-2 focus-visible:outline-offset-4"
                    >
                        <BoardIcon name="close" />
                    </button>
                </header>
                {children}
            </motion.div>
        </dialog>
    );
}
