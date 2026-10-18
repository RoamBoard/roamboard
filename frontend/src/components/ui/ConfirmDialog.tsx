"use client";

import { useRef } from "react";
import { X } from "lucide-react";
import { useDialogFocus } from "@/lib/use-dialog-focus";

type Props = {
    title: string;
    description: string;
    confirmLabel: string;
    confirmVariant?: "default" | "destructive";
    error?: string | null;
    loading?: boolean;
    onCancel: () => unknown;
    onConfirm: () => unknown;
};

export default function ConfirmDialog({
    title,
    description,
    confirmLabel,
    confirmVariant,
    error,
    loading,
    onCancel,
    onConfirm
}: Props) {
    const dialogRef = useRef<HTMLDivElement>(null);
    useDialogFocus(dialogRef, onCancel);

    const isDestructive =
        confirmVariant === "destructive" ||
        (confirmVariant === undefined && /unfriend|remove|delete|discard|leave/i.test(confirmLabel));

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
                className="bg-background border-line relative w-full max-w-md rounded-[2px] border p-7 shadow-2xl outline-none"
            >
                <button
                    type="button"
                    aria-label="Close dialog"
                    onClick={onCancel}
                    className="border-line text-muted-foreground hover:bg-faint hover:text-foreground absolute top-5 right-5 flex size-8 cursor-pointer items-center justify-center rounded-[2px] border transition-colors focus-visible:outline-2 focus-visible:outline-offset-4"
                >
                    <X size={16} strokeWidth={1.5} />
                </button>

                <h2 id="confirm-title" className="font-display text-24 sm:text-30 pr-8 font-bold">
                    {title}
                </h2>
                <p id="confirm-description" className="text-14 text-muted-foreground mt-3 leading-6">
                    {description}
                </p>
                {error && (
                    <div
                        role="alert"
                        className="text-12 mt-4 rounded-[2px] border border-red-500/30 bg-red-500/10 p-2.5 font-medium text-red-500"
                    >
                        {error}
                    </div>
                )}

                <div className="mt-7 flex flex-col justify-end gap-3 sm:flex-row">
                    <button
                        type="button"
                        disabled={loading}
                        onClick={onCancel}
                        className="border-line text-13 text-muted-foreground hover:text-foreground hover:bg-faint hover:border-foreground/30 cursor-pointer rounded-[2px] border px-5 py-3 font-medium transition-all focus-visible:outline-2 focus-visible:outline-offset-4 disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        disabled={loading}
                        onClick={onConfirm}
                        className={
                            isDestructive
                                ? "text-13 cursor-pointer rounded-[2px] border border-red-600 bg-red-600 px-5 py-3 font-medium text-white shadow-xs transition-all hover:border-red-700 hover:bg-red-700 hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-4 disabled:opacity-50"
                                : "border-foreground bg-foreground text-background hover:bg-foreground/85 text-13 cursor-pointer rounded-[2px] border px-5 py-3 font-medium shadow-xs transition-all hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-4 disabled:opacity-50"
                        }
                    >
                        {loading ? "Processing…" : confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}
