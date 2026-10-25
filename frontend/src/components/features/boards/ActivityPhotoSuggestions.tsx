/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useRef, useState } from "react";
import { StoryPhotoCredit } from "./StoryPhoto";
import {
    findActivityPhotoSuggestions,
    selectActivityPhotoSuggestion,
    type ActivityPhotoSuggestion,
    type ActivityPhotoSuggestionTarget
} from "@/lib/providers";

export default function ActivityPhotoSuggestions({
    target,
    onSelect
}: {
    target: ActivityPhotoSuggestionTarget;
    onSelect: (photo: ActivityPhotoSuggestion) => void;
}) {
    const [photos, setPhotos] = useState<ActivityPhotoSuggestion[]>([]);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState("");
    const pending = useRef<AbortController | null>(null);
    const targetKey = JSON.stringify(target);
    useEffect(() => () => pending.current?.abort(), [targetKey]);
    async function discover() {
        pending.current?.abort();
        const controller = new AbortController();
        pending.current = controller;
        setBusy(true);
        setMessage("");
        setPhotos([]);
        try {
            const results = await findActivityPhotoSuggestions(target, controller.signal);
            if (controller.signal.aborted) return;
            setPhotos(results);
            if (!results.length)
                setMessage("No suitable nearby or regional photos found. Your own photos are always welcome.");
        } catch (caught) {
            if (!controller.signal.aborted)
                setMessage(caught instanceof Error ? caught.message : "Photo suggestions are unavailable.");
        } finally {
            if (!controller.signal.aborted) setBusy(false);
        }
    }
    async function choose(photo: ActivityPhotoSuggestion) {
        const controller = new AbortController();
        pending.current = controller;
        setBusy(true);
        setMessage("");
        try {
            const selected = await selectActivityPhotoSuggestion(target, photo.id, controller.signal);
            if (!controller.signal.aborted) {
                onSelect(selected);
                setPhotos([]);
                setMessage("Illustrative photo selected. Save your activity and Board to keep it.");
            }
        } catch (caught) {
            if (!controller.signal.aborted)
                setMessage(caught instanceof Error ? caught.message : "Photo could not be selected.");
        } finally {
            if (!controller.signal.aborted) setBusy(false);
        }
    }
    return (
        <section className="border-line mt-5 border-t pt-4" aria-label="Illustrative photo suggestions">
            <p className="text-muted-foreground text-xs leading-relaxed">
                No photo of the exact place? Explore relevant photos from nearby, then the wider region.
            </p>
            <button
                type="button"
                disabled={busy}
                onClick={() => void discover()}
                className="mt-2 min-h-11 text-xs underline disabled:opacity-50"
            >
                {busy ? "Finding your view…" : "Find alternatives"}
            </button>
            {message ? (
                <p role="status" className="mt-2 text-xs">
                    {message}
                </p>
            ) : null}
            <ul className="mt-3 grid gap-3 sm:grid-cols-2">
                {photos.map((photo) => (
                    <li key={photo.id}>
                        <figure>
                            <button
                                type="button"
                                disabled={busy}
                                onClick={() => void choose(photo)}
                                className="w-full overflow-hidden rounded-xl text-left focus-visible:outline-2 focus-visible:outline-offset-4"
                            >
                                <img
                                    src={photo.thumbnailUrl}
                                    alt={photo.alt}
                                    className="aspect-[4/3] w-full object-cover"
                                />
                                <span className="mt-2 block text-xs">Illustrative · {photo.context.locationLabel}</span>
                                <span className="text-muted-foreground mt-1 block text-[10px]">Select this photo</span>
                            </button>
                            <StoryPhotoCredit image={{ ...photo, source: "application", context: undefined }} />
                        </figure>
                    </li>
                ))}
            </ul>
        </section>
    );
}
