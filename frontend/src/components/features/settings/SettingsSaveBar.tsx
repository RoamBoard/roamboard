"use client";

import { useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import type { ProfileSaveError, ProfileSettingsField } from "@/lib/profile-settings";

type Props = {
    isDirty: boolean;
    onReset: () => void;
    saving?: boolean;
    error?: ProfileSaveError | null;
    onFocusField?: (field: ProfileSettingsField) => void;
    onReload?: () => void;
    showToast?: boolean;
    onDismissToast?: () => void;
    onUndo?: () => void;
    canUndo?: boolean;
    toastKey?: number | string;
};

const AUTO_DISMISS_MS = 6000;

const fieldLabels: Record<ProfileSettingsField, string> = {
    displayName: "Display name",
    username: "Username",
    description: "Biography",
    location: "Location",
    occupation: "Occupation",
    languages: "Languages",
    interests: "Tags",
    defaultBoardVisibility: "Default Board visibility"
};

export default function SettingsSaveBar({
    isDirty,
    onReset,
    saving = false,
    error = null,
    onFocusField,
    onReload,
    showToast = false,
    onDismissToast,
    onUndo,
    canUndo = false,
    toastKey = 0
}: Props) {
    const errorRef = useRef<HTMLDivElement>(null);
    const hasError = Boolean(error);
    useEffect(() => {
        if (hasError) errorRef.current?.focus({ preventScroll: true });
    }, [hasError]);

    const isPausedRef = useRef(false);
    const isHoveredRef = useRef(false);
    const isFocusedRef = useRef(false);

    const remainingRef = useRef(AUTO_DISMISS_MS);
    const startRef = useRef<number>(0);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const onDismissToastRef = useRef(onDismissToast);
    useEffect(() => {
        onDismissToastRef.current = onDismissToast;
    }, [onDismissToast]);

    const pauseTimer = useCallback(() => {
        if (!showToast || isPausedRef.current) return;
        isPausedRef.current = true;
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
        const elapsed = Date.now() - startRef.current;
        remainingRef.current = Math.max(0, remainingRef.current - elapsed);
    }, [showToast]);

    const resumeTimer = useCallback(() => {
        if (!showToast || !isPausedRef.current) return;
        isPausedRef.current = false;
        startRef.current = Date.now();
        if (remainingRef.current > 0) {
            timerRef.current = setTimeout(() => {
                onDismissToastRef.current?.();
            }, remainingRef.current);
        } else {
            onDismissToastRef.current?.();
        }
    }, [showToast]);

    useEffect(() => {
        if (!showToast) {
            if (timerRef.current) clearTimeout(timerRef.current);
            isPausedRef.current = false;
            isHoveredRef.current = false;
            isFocusedRef.current = false;
            return;
        }

        remainingRef.current = AUTO_DISMISS_MS;
        startRef.current = Date.now();
        isPausedRef.current = false;

        timerRef.current = setTimeout(() => {
            onDismissToastRef.current?.();
        }, AUTO_DISMISS_MS);

        const handleVisibilityChange = () => {
            if (typeof document !== "undefined" && document.hidden) {
                pauseTimer();
            } else if (!isHoveredRef.current && !isFocusedRef.current) {
                resumeTimer();
            }
        };

        const handleWindowBlur = () => {
            pauseTimer();
        };

        const handleWindowFocus = () => {
            const isDocHidden = typeof document !== "undefined" && document.hidden;
            if (!isHoveredRef.current && !isFocusedRef.current && !isDocHidden) {
                resumeTimer();
            }
        };

        if (typeof document !== "undefined" && typeof document.addEventListener === "function") {
            document.addEventListener("visibilitychange", handleVisibilityChange);
        }
        if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
            window.addEventListener("blur", handleWindowBlur);
            window.addEventListener("focus", handleWindowFocus);
        }

        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
            if (typeof document !== "undefined" && typeof document.removeEventListener === "function") {
                document.removeEventListener("visibilitychange", handleVisibilityChange);
            }
            if (typeof window !== "undefined" && typeof window.removeEventListener === "function") {
                window.removeEventListener("blur", handleWindowBlur);
                window.removeEventListener("focus", handleWindowFocus);
            }
        };
    }, [showToast, toastKey, pauseTimer, resumeTimer]);

    const handleMouseEnter = () => {
        isHoveredRef.current = true;
        pauseTimer();
    };

    const handleMouseLeave = () => {
        isHoveredRef.current = false;
        if (!isFocusedRef.current) {
            resumeTimer();
        }
    };

    const handleFocus = () => {
        isFocusedRef.current = true;
        pauseTimer();
    };

    const handleBlur = (event: React.FocusEvent) => {
        if (event.currentTarget.contains(event.relatedTarget as Node)) {
            return;
        }
        isFocusedRef.current = false;
        if (!isHoveredRef.current) {
            resumeTimer();
        }
    };

    const showFloatingBar = isDirty || hasError || saving;
    if (!showFloatingBar && !showToast) return null;

    return (
        <>
            {showFloatingBar && (
                <aside
                    aria-label="Form actions"
                    className="bg-background/95 border-line fixed inset-x-4 bottom-6 z-40 mx-auto flex max-h-[min(28rem,calc(100dvh-3rem))] max-w-3xl flex-col gap-3 overflow-y-auto rounded-[2px] border px-4 py-3 shadow-xl backdrop-blur-md sm:px-6"
                >
                    {error && (
                        <div
                            ref={errorRef}
                            role="alert"
                            tabIndex={-1}
                            aria-labelledby="profile-save-error-title"
                            className="border-feedback-error-border bg-feedback-error-surface text-feedback-error text-12 rounded-[2px] border p-4 focus-visible:outline-2 focus-visible:outline-offset-2"
                        >
                            <p id="profile-save-error-title" className="font-semibold">
                                Your changes weren&apos;t saved
                            </p>
                            <p className="mt-1">{error.message}</p>
                            {error.fields && (
                                <ul className="mt-3 space-y-2">
                                    {Object.entries(error.fields).map(([field, message]) => (
                                        <li key={field}>
                                            <button
                                                type="button"
                                                onClick={() => onFocusField?.(field as ProfileSettingsField)}
                                                className="cursor-pointer text-left underline underline-offset-4 focus-visible:outline-2"
                                            >
                                                {fieldLabels[field as ProfileSettingsField]}: {message}
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                            {error.action === "sign-in" && (
                                <Link
                                    href="/login"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="mt-3 inline-block underline underline-offset-4"
                                >
                                    Sign in in a new tab
                                </Link>
                            )}
                            {error.action === "reload" && (
                                <button
                                    type="button"
                                    onClick={onReload}
                                    className="mt-3 cursor-pointer underline underline-offset-4"
                                >
                                    Reload latest profile
                                </button>
                            )}
                        </div>
                    )}
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-3">
                            <button
                                type="submit"
                                disabled={saving || !isDirty}
                                className="bg-foreground text-background hover:bg-foreground/90 font-body text-12 cursor-pointer rounded-[2px] px-5 py-2.5 font-bold tracking-wider uppercase transition-colors focus-visible:outline-1 focus-visible:outline-offset-4 disabled:cursor-wait disabled:opacity-60"
                            >
                                {saving ? "Saving..." : "Save Changes"}
                            </button>
                            <button
                                type="button"
                                disabled={saving}
                                onClick={onReset}
                                className="border-line bg-background text-12 text-muted-foreground hover:text-foreground hover:border-foreground font-body cursor-pointer rounded-[2px] border px-4 py-2 font-medium transition-colors disabled:cursor-wait disabled:opacity-60"
                            >
                                Reset
                            </button>
                            <span role="status" className="text-muted-foreground text-12 font-medium">
                                {saving ? "Saving your profile. Please wait..." : "You have unsaved changes."}
                            </span>
                        </div>
                        <Link
                            href="/profile"
                            className="text-12 text-muted-foreground hover:text-foreground font-body font-medium transition-colors hover:underline"
                        >
                            view live profile &rarr;
                        </Link>
                    </div>
                </aside>
            )}

            {/* Timed Action Toast: appears after saving with 6s auto-dismiss and progress bar */}
            <div
                role="status"
                aria-live="polite"
                inert={!showToast ? true : undefined}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                onFocus={handleFocus}
                onBlur={handleBlur}
                onKeyDown={(e) => {
                    if (e.key === "Escape") {
                        onDismissToast?.();
                    }
                }}
                className={`group border-line bg-background/95 fixed inset-x-0 bottom-6 z-50 mx-auto flex w-fit max-w-sm items-center gap-3 overflow-hidden rounded-[2px] border px-4 py-2.5 shadow-2xl backdrop-blur-md transition-all duration-300 ease-out motion-reduce:transform-none motion-reduce:transition-none sm:max-w-md ${
                    showToast
                        ? "pointer-events-auto translate-y-0 opacity-100"
                        : "pointer-events-none translate-y-12 opacity-0"
                }`}
            >
                <span
                    aria-hidden="true"
                    className="bg-feedback-success text-10 flex size-4 shrink-0 items-center justify-center rounded-full font-bold text-white"
                >
                    ✓
                </span>
                <span className="text-12 text-foreground font-medium whitespace-nowrap">Changes saved</span>

                {canUndo && onUndo && (
                    <button
                        type="button"
                        onClick={() => {
                            onUndo();
                            onDismissToast?.();
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
                        <div key={toastKey} className="bg-feedback-success animate-toast-progress h-full origin-left" />
                    )}
                </div>
            </div>
        </>
    );
}
