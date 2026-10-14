"use client";

import { useRef } from "react";
import { useDialogFocus } from "@/lib/use-dialog-focus";

type Props = {
    title: string;
    description: string;
    confirmLabel: string;
    onCancel: () => void;
    onConfirm: () => void;
};

export default function ConfirmDialog({
    title,
    description,
    confirmLabel,
    onCancel,
    onConfirm
}: Props) {
    const dialogRef = useRef<HTMLDivElement>(null);
    useDialogFocus(dialogRef, onCancel);

    return (
        <div
            className="fixed inset-0 z-[60] grid place-items-center bg-black/45 p-4"
            role="presentation"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget) onCancel();
            }}
        >
            <div
                ref={dialogRef}
                tabIndex={-1}
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="confirm-title"
                aria-describedby="confirm-description"
                className="bg-background w-full max-w-md p-7 shadow-2xl outline-none"
            >
                <h2
                    id="confirm-title"
                    className="font-display text-30 font-bold"
                >
                    {title}
                </h2>
                <p
                    id="confirm-description"
                    className="text-14 text-muted-foreground mt-3 leading-6"
                >
                    {description}
                </p>
                <div className="mt-7 flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="border-line text-13 border px-5 py-3"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        className="border-foreground bg-foreground text-13 text-background border px-5 py-3"
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}
