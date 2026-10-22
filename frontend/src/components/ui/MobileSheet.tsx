"use client";

import { useEffect, useId, useRef, useState, type ReactNode, type Ref } from "react";
import { motion, useReducedMotion } from "motion/react";
import { X } from "lucide-react";

export default function MobileSheet({
    id,
    title,
    onClose,
    children,
    action,
    closeButtonRef
}: {
    id: string;
    title: string;
    onClose: () => void;
    children: ReactNode;
    action?: ReactNode;
    closeButtonRef?: Ref<HTMLButtonElement>;
}) {
    const dialogRef = useRef<HTMLDialogElement>(null);
    const titleId = useId();
    const [closing, setClosing] = useState(false);
    const reducedMotion = useReducedMotion();

    useEffect(() => {
        const dialog = dialogRef.current;
        const previousFocus = document.activeElement;
        const previousOverflow = document.body.style.overflow;
        dialog?.showModal();
        document.body.style.overflow = "hidden";
        return () => {
            dialog?.close();
            document.body.style.overflow = previousOverflow;
            if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
        };
    }, []);

    return (
        <dialog
            ref={dialogRef}
            id={id}
            aria-labelledby={titleId}
            onCancel={(event) => {
                event.preventDefault();
                setClosing(true);
            }}
            onKeyDown={(event) => {
                if (event.key === "Escape") event.stopPropagation();
            }}
            onClick={(event) => {
                if (event.target === event.currentTarget) setClosing(true);
            }}
            className="fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none border-0 bg-transparent p-0 text-inherit backdrop:bg-black/35 open:flex open:items-end"
        >
            <motion.div
                initial={{ y: reducedMotion ? 0 : 24, opacity: 0 }}
                animate={{ y: closing && !reducedMotion ? 24 : 0, opacity: closing ? 0 : 1 }}
                transition={{ duration: reducedMotion ? 0 : 0.2, ease: "easeOut" }}
                onAnimationComplete={() => {
                    if (closing) onClose();
                }}
                className="bg-background text-foreground border-line flex max-h-[85dvh] w-full min-w-0 flex-col overflow-hidden border-t pb-[env(safe-area-inset-bottom)] shadow-2xl"
            >
                <header className="border-line flex shrink-0 items-center gap-3 border-b px-4 py-2">
                    <h2 id={titleId} className="text-12 tracking-label min-w-0 flex-1 font-bold uppercase">
                        {title}
                    </h2>
                    {action}
                    <button
                        ref={closeButtonRef}
                        type="button"
                        aria-label={`Close ${title.toLowerCase()}`}
                        onClick={() => setClosing(true)}
                        className="hover:bg-faint flex size-11 shrink-0 items-center justify-center focus-visible:outline-2 focus-visible:-outline-offset-2"
                    >
                        <X size={20} aria-hidden="true" />
                    </button>
                </header>
                <div className="min-h-0 overflow-y-auto overscroll-contain">{children}</div>
            </motion.div>
        </dialog>
    );
}
