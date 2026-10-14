"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";

type Props = {
    isDirty: boolean;
    onReset: () => void;
    showToast: boolean;
    onDismissToast: () => void;
    onUndo?: () => void;
    canUndo?: boolean;
    toastKey?: number | string;
};

const AUTO_DISMISS_MS = 6000;

export default function SettingsSaveBar({
    isDirty,
    onReset,
    showToast,
    onDismissToast,
    onUndo,
    canUndo = false,
    toastKey = 0
}: Props) {
    const remainingRef = useRef(AUTO_DISMISS_MS);
    const startRef = useRef<number>(0);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    // Auto-dismiss 6-second timer management with hover-pause support
    useEffect(() => {
        if (!showToast) {
            if (timerRef.current) clearTimeout(timerRef.current);
            return;
        }

        remainingRef.current = AUTO_DISMISS_MS;
        startRef.current = Date.now();

        timerRef.current = setTimeout(() => {
            onDismissToast();
        }, AUTO_DISMISS_MS);

        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, [showToast, toastKey, onDismissToast]);

    const handleMouseEnter = () => {
        if (!showToast) return;
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
        const elapsed = Date.now() - startRef.current;
        remainingRef.current = Math.max(0, remainingRef.current - elapsed);
    };

    const handleMouseLeave = () => {
        if (!showToast) return;
        startRef.current = Date.now();
        if (remainingRef.current > 0) {
            timerRef.current = setTimeout(() => {
                onDismissToast();
            }, remainingRef.current);
        } else {
            onDismissToast();
        }
    };

    return (
        <>
            {/* Contextual Floating Save Bar: only visible when changes are made */}
            <aside
                aria-label="Form actions"
                inert={!isDirty ? true : undefined}
                className={`fixed bottom-6 inset-x-4 max-w-3xl mx-auto z-40 bg-background/95 backdrop-blur-md border border-line rounded-[2px] shadow-xl px-4 py-3 sm:px-6 flex flex-wrap items-center justify-between gap-3 transition-all duration-300 ease-out ${
                    isDirty
                        ? "translate-y-0 opacity-100 pointer-events-auto"
                        : "translate-y-16 opacity-0 pointer-events-none"
                }`}
            >
                <div className="flex items-center gap-3">
                    <button
                        type="submit"
                        className="bg-foreground text-background hover:bg-foreground/90 font-body text-12 cursor-pointer rounded-[2px] px-5 py-2.5 font-bold uppercase tracking-wider transition-colors focus-visible:outline-1 focus-visible:outline-offset-4"
                    >
                        Save Changes
                    </button>
                    <button
                        type="button"
                        onClick={onReset}
                        className="border-line bg-background text-12 text-muted-foreground hover:text-foreground hover:border-foreground font-body cursor-pointer rounded-[2px] border px-4 py-2 font-medium transition-colors"
                    >
                        Reset Defaults
                    </button>
                </div>

                <Link
                    href="/profile"
                    className="text-12 text-muted-foreground hover:text-foreground font-body font-medium transition-colors hover:underline"
                >
                    view live profile →
                </Link>
            </aside>

            {/* Timed Action Toast: appears after saving with 10s auto-dismiss and progress bar */}
            <div
                role="status"
                aria-live="polite"
                inert={!showToast ? true : undefined}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                className={`group fixed bottom-6 inset-x-0 mx-auto w-fit max-w-sm sm:max-w-md z-50 bg-background/95 backdrop-blur-md border border-line rounded-[2px] shadow-2xl px-4 py-2.5 flex items-center gap-3 overflow-hidden transition-all duration-300 ease-out ${
                    showToast
                        ? "translate-y-0 opacity-100 pointer-events-auto"
                        : "translate-y-12 opacity-0 pointer-events-none"
                }`}
            >
                <span
                    aria-hidden="true"
                    className="size-4 rounded-full bg-emerald-600 text-white flex items-center justify-center text-10 font-bold shrink-0"
                >
                    ✓
                </span>
                <span className="text-12 text-foreground font-medium whitespace-nowrap">
                    Changes saved
                </span>

                {canUndo && onUndo && (
                    <button
                        type="button"
                        onClick={() => {
                            onUndo();
                            onDismissToast();
                        }}
                        className="text-11 font-bold uppercase tracking-wider text-foreground underline hover:text-muted-foreground cursor-pointer transition-colors ml-1 whitespace-nowrap"
                    >
                        Undo
                    </button>
                )}

                <button
                    type="button"
                    onClick={onDismissToast}
                    aria-label="Dismiss notification"
                    className="text-muted-foreground hover:text-foreground text-xs cursor-pointer ml-1 p-0.5 rounded hover:bg-faint transition-colors"
                >
                    ✕
                </button>

                {/* 6s countdown line at the bottom */}
                <div className="absolute bottom-0 inset-x-0 h-[2.5px] bg-line/40 overflow-hidden">
                    {showToast && (
                        <div
                            key={toastKey}
                            className="h-full bg-emerald-600 dark:bg-emerald-500 origin-left animate-toast-progress"
                        />
                    )}
                </div>
            </div>
        </>
    );
}
