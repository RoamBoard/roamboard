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
    saving?: boolean;
};

const AUTO_DISMISS_MS = 6000;

export default function SettingsSaveBar({
    isDirty,
    onReset,
    showToast,
    onDismissToast,
    onUndo,
    canUndo = false,
    toastKey = 0,
    saving = false
}: Props) {
    const remainingRef = useRef(AUTO_DISMISS_MS);
    const startRef = useRef<number>(0);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const onDismissToastRef = useRef(onDismissToast);
    useEffect(() => {
        onDismissToastRef.current = onDismissToast;
    }, [onDismissToast]);

    // Auto-dismiss 6-second timer management with hover-pause support
    useEffect(() => {
        if (!showToast) {
            if (timerRef.current) clearTimeout(timerRef.current);
            return;
        }

        remainingRef.current = AUTO_DISMISS_MS;
        startRef.current = Date.now();

        timerRef.current = setTimeout(() => {
            onDismissToastRef.current();
        }, AUTO_DISMISS_MS);

        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, [showToast, toastKey]);

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
                onDismissToastRef.current();
            }, remainingRef.current);
        } else {
            onDismissToastRef.current();
        }
    };

    return (
        <>
            {/* Contextual Floating Save Bar: only visible when changes are made */}
            <aside
                aria-label="Form actions"
                inert={!isDirty ? true : undefined}
                className={`bg-background/95 border-line fixed inset-x-4 bottom-6 z-40 mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 rounded-[2px] border px-4 py-3 shadow-xl backdrop-blur-md transition-all duration-300 ease-out motion-reduce:transform-none motion-reduce:transition-none sm:px-6 ${
                    isDirty
                        ? "pointer-events-auto translate-y-0 opacity-100"
                        : "pointer-events-none translate-y-16 opacity-0"
                }`}
            >
                <div className="flex items-center gap-3">
                    <button
                        type="submit"
                        disabled={saving}
                        className="bg-foreground text-background hover:bg-foreground/90 font-body text-12 cursor-pointer rounded-[2px] px-5 py-2.5 font-bold tracking-wider uppercase transition-colors focus-visible:outline-1 focus-visible:outline-offset-4"
                    >
                        {saving ? "Saving…" : "Save Changes"}
                    </button>
                    <button
                        type="button"
                        onClick={onReset}
                        className="border-line bg-background text-12 text-muted-foreground hover:text-foreground hover:border-foreground font-body cursor-pointer rounded-[2px] border px-4 py-2 font-medium transition-colors"
                    >
                        Reset
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
                className={`group bg-background/95 border-line fixed inset-x-0 bottom-6 z-50 mx-auto flex w-fit max-w-sm items-center gap-3 overflow-hidden rounded-[2px] border px-4 py-2.5 shadow-2xl backdrop-blur-md transition-all duration-300 ease-out motion-reduce:transform-none motion-reduce:transition-none sm:max-w-md ${
                    showToast
                        ? "pointer-events-auto translate-y-0 opacity-100"
                        : "pointer-events-none translate-y-12 opacity-0"
                }`}
            >
                <span
                    aria-hidden="true"
                    className="text-10 flex size-4 shrink-0 items-center justify-center rounded-full bg-emerald-600 font-bold text-white"
                >
                    ✓
                </span>
                <span className="text-12 text-foreground font-medium whitespace-nowrap">Changes saved</span>

                {canUndo && onUndo && (
                    <button
                        type="button"
                        onClick={() => {
                            onUndo();
                            onDismissToast();
                        }}
                        className="text-11 text-foreground hover:text-muted-foreground ml-1 cursor-pointer font-bold tracking-wider whitespace-nowrap uppercase underline transition-colors"
                    >
                        Undo
                    </button>
                )}

                <button
                    type="button"
                    onClick={onDismissToast}
                    aria-label="Dismiss notification"
                    className="text-muted-foreground hover:text-foreground hover:bg-faint ml-1 cursor-pointer rounded p-0.5 text-xs transition-colors"
                >
                    ✕
                </button>

                {/* 6s countdown line at the bottom */}
                <div className="bg-line/40 absolute inset-x-0 bottom-0 h-[2.5px] overflow-hidden">
                    {showToast && (
                        <div
                            key={toastKey}
                            className="animate-toast-progress h-full origin-left bg-emerald-600 dark:bg-emerald-500"
                        />
                    )}
                </div>
            </div>
        </>
    );
}
