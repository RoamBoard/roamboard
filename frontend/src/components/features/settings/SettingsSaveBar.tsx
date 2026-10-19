"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import type { ProfileSaveError, ProfileSettingsField } from "@/lib/profile-settings";

type Props = {
    isDirty: boolean;
    onReset: () => void;
    saving?: boolean;
    saved?: boolean;
    error?: ProfileSaveError | null;
    onFocusField?: (field: ProfileSettingsField) => void;
    onReload?: () => void;
};

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
    saved = false,
    error = null,
    onFocusField,
    onReload
}: Props) {
    const errorRef = useRef<HTMLDivElement>(null);
    const hasError = Boolean(error);
    useEffect(() => {
        if (hasError) errorRef.current?.focus({ preventScroll: true });
    }, [hasError]);

    if (!isDirty && !error && !saving && !saved) return null;

    return (
        <aside
            aria-label="Form actions"
            className="bg-background/95 border-line fixed inset-x-4 bottom-6 z-40 mx-auto flex max-h-[min(28rem,calc(100dvh-3rem))] max-w-3xl flex-col gap-3 overflow-y-auto rounded-[2px] border p-4 shadow-xl backdrop-blur-md sm:p-6"
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
            <p role="status" className="text-muted-foreground text-12">
                {saved
                    ? "Profile saved. Opening your profile..."
                    : saving
                      ? "Saving your profile. Please wait..."
                      : "You have unsaved changes."}
            </p>
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3">
                    <button
                        type="submit"
                        disabled={saving || saved || !isDirty}
                        className="bg-foreground text-background hover:bg-foreground/90 font-body text-12 cursor-pointer rounded-[2px] px-5 py-2.5 font-bold tracking-wider uppercase transition-colors focus-visible:outline-1 focus-visible:outline-offset-4 disabled:cursor-wait disabled:opacity-60"
                    >
                        {saved ? "Saved" : saving ? "Saving..." : "Save Changes"}
                    </button>
                    <button
                        type="button"
                        disabled={saving || saved}
                        onClick={onReset}
                        className="border-line bg-background text-12 text-muted-foreground hover:text-foreground hover:border-foreground font-body cursor-pointer rounded-[2px] border px-4 py-2 font-medium transition-colors disabled:cursor-wait disabled:opacity-60"
                    >
                        Reset
                    </button>
                </div>
                <Link
                    href="/profile"
                    className="text-12 text-muted-foreground hover:text-foreground font-body font-medium transition-colors hover:underline"
                >
                    view live profile &rarr;
                </Link>
            </div>
        </aside>
    );
}
