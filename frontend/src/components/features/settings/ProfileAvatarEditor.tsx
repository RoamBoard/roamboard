"use client";

import { useState } from "react";
import Image from "next/image";

export const AVATAR_PRESETS = [
    {
        label: "Rowan (Default)",
        url: "https://images.unsplash.com/photo-1769786186317-272d062fcf93?auto=format&fit=crop&w=400&q=80"
    },
    {
        label: "Balkans Backpacking",
        url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80"
    },
    {
        label: "Mountain Wanderer",
        url: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80"
    },
    {
        label: "Urban Explorer",
        url: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=400&q=80"
    }
];

export function validateAvatarUrl(url: string): {
    isValid: boolean;
    error?: string;
    normalizedUrl?: string;
} {
    const trimmed = url.trim();
    if (!trimmed) {
        return { isValid: true, normalizedUrl: "" };
    }

    if (trimmed.startsWith("/")) {
        return { isValid: true, normalizedUrl: trimmed };
    }

    try {
        const parsed = new URL(trimmed);
        if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
            return {
                isValid: false,
                error: "URL must begin with http:// or https://"
            };
        }

        // Check against supported Next.js image domains (currently images.unsplash.com)
        if (parsed.hostname !== "images.unsplash.com") {
            return {
                isValid: false,
                error: "Host not supported. Only images from images.unsplash.com can be previewed."
            };
        }

        return { isValid: true, normalizedUrl: trimmed };
    } catch {
        return {
            isValid: false,
            error: "Please enter a valid image URL."
        };
    }
}

type Props = {
    avatarUrl: string;
    onChangeAvatarUrl: (url: string) => void;
};

export default function ProfileAvatarEditor({
    avatarUrl,
    onChangeAvatarUrl
}: Props) {
    const [draftUrl, setDraftUrl] = useState(avatarUrl);
    const [prevPropUrl, setPrevPropUrl] = useState(avatarUrl);
    const [hasLoadError, setHasLoadError] = useState(false);

    // Sync draftUrl when external prop changes (e.g. preset clicked, reset, or undo)
    if (avatarUrl !== prevPropUrl) {
        setPrevPropUrl(avatarUrl);
        setDraftUrl(avatarUrl);
        setHasLoadError(false);
    }

    const validation = validateAvatarUrl(draftUrl);
    const isSupported = validation.isValid && Boolean(validation.normalizedUrl);
    const previewUrl = isSupported ? validation.normalizedUrl! : null;

    const handleInputChange = (value: string) => {
        setDraftUrl(value);
        setHasLoadError(false);
        onChangeAvatarUrl(value);
    };

    const handlePresetSelect = (presetUrl: string) => {
        setDraftUrl(presetUrl);
        setHasLoadError(false);
        onChangeAvatarUrl(presetUrl);
    };

    return (
        <div className="border-line bg-background rounded-[2px] border p-6">
            <h2 className="font-display text-16 text-foreground font-bold tracking-tight uppercase">
                Profile Picture
            </h2>
            <p className="text-12 text-muted-foreground mt-0.5">
                Set your profile portrait displayed across your boards and
                traveler cards.
            </p>

            <div className="mt-5 flex flex-col gap-6 sm:flex-row sm:items-center">
                {/* Current Photo Thumbnail */}
                <div className="bg-faint border-line relative aspect-[3/4] h-28 shrink-0 overflow-hidden rounded-[2px] border shadow-xs">
                    {previewUrl && !hasLoadError ? (
                        <Image
                            src={previewUrl}
                            alt="Current profile preview"
                            fill
                            sizes="120px"
                            className="object-cover"
                            unoptimized
                            onError={() => setHasLoadError(true)}
                        />
                    ) : (
                        <div className="text-10 text-muted-foreground flex h-full w-full flex-col items-center justify-center p-2 text-center select-none">
                            {hasLoadError ? (
                                <span>Failed to load</span>
                            ) : draftUrl.trim() === "" ? (
                                <span>No photo</span>
                            ) : !validation.isValid ? (
                                <span>Invalid URL</span>
                            ) : (
                                <span>No photo</span>
                            )}
                        </div>
                    )}
                </div>

                <div className="flex-1 space-y-3">
                    <div>
                        <label
                            htmlFor="avatar-url-input"
                            className="text-10 tracking-label text-muted-foreground block font-bold uppercase"
                        >
                            Image URL
                        </label>
                        <input
                            id="avatar-url-input"
                            type="text"
                            value={draftUrl}
                            onChange={(e) => handleInputChange(e.target.value)}
                            placeholder="https://images.unsplash.com/..."
                            className="border-line bg-background text-12 text-foreground placeholder:text-muted-foreground font-body focus:border-foreground mt-1 w-full rounded-[2px] border px-3 py-2 transition-colors focus-visible:outline-none"
                        />
                        {validation.error && draftUrl.trim() !== "" && (
                            <p
                                role="alert"
                                className="text-11 mt-1 font-medium text-amber-600 dark:text-amber-400"
                            >
                                {validation.error}
                            </p>
                        )}
                    </div>

                    {/* Quick Preset Selector */}
                    <div>
                        <span className="text-10 tracking-label text-muted-foreground block font-bold uppercase">
                            Or choose a preset
                        </span>
                        <div className="mt-1.5 flex flex-wrap gap-2">
                            {AVATAR_PRESETS.map((preset) => (
                                <button
                                    key={preset.label}
                                    type="button"
                                    onClick={() =>
                                        handlePresetSelect(preset.url)
                                    }
                                    className={`border-line text-10 text-muted-foreground hover:text-foreground hover:border-foreground cursor-pointer rounded-[2px] border px-2.5 py-1 font-medium transition-colors ${
                                        draftUrl === preset.url
                                            ? "bg-faint border-foreground text-foreground"
                                            : "bg-background"
                                    }`}
                                >
                                    {preset.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Photo Upload Notice */}
                    <div className="border-line bg-faint/40 rounded-[2px] border border-dashed p-3">
                        <div className="flex items-center gap-1.5">
                            <span className="bg-foreground h-1.5 w-1.5 shrink-0 rounded-full" />
                            <span className="text-10 tracking-label text-foreground font-bold uppercase">
                                Photo Upload Notice
                            </span>
                        </div>
                        <p className="text-11 text-muted-foreground mt-1 leading-normal font-medium">
                            Upload should be implemented later when the backend
                            framework is created. Currently using image URL and
                            presets.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
