/* eslint-disable @next/next/no-img-element */
"use client";
import { useEffect, useRef, useState } from "react";
import { Search, Plus } from "lucide-react";
import {
    searchActivityPhotos,
    selectManualActivityPhoto,
    type ManualPhotoPage,
    type ProviderPhoto
} from "@/lib/providers";

export default function ActivityPhotoSearch({
    selectedIds,
    onSelect,
    onPreview,
    disabled = false
}: {
    selectedIds: string[];
    onSelect: (photo: ProviderPhoto) => void;
    onPreview: (photos: ProviderPhoto[], index: number) => void;
    disabled?: boolean;
}) {
    const [query, setQuery] = useState("");
    const [result, setResult] = useState<ManualPhotoPage | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const pending = useRef<AbortController | null>(null);
    useEffect(() => () => pending.current?.abort(), []);
    async function search(page = 1, words = query.trim()) {
        if (!words || disabled) return;
        pending.current?.abort();
        const controller = new AbortController();
        pending.current = controller;
        setBusy(true);
        setError("");
        try {
            const data = await searchActivityPhotos(words, page, controller.signal);
            if (!controller.signal.aborted) setResult(data);
        } catch (caught) {
            if (!controller.signal.aborted)
                setError(caught instanceof Error ? caught.message : "Photo search is unavailable.");
        } finally {
            if (!controller.signal.aborted) setBusy(false);
        }
    }
    async function select(photo: ProviderPhoto) {
        if (busy || disabled || selectedIds.includes(photo.id)) return;
        pending.current?.abort();
        const controller = new AbortController();
        pending.current = controller;
        setBusy(true);
        setError("");
        try {
            const canonical = await selectManualActivityPhoto(photo.id, controller.signal);
            if (!controller.signal.aborted) onSelect(canonical);
        } catch (caught) {
            if (!controller.signal.aborted)
                setError(caught instanceof Error ? caught.message : "This photo could not be selected.");
        } finally {
            if (!controller.signal.aborted) setBusy(false);
        }
    }
    return (
        <section aria-label="Search Unsplash photos" className="border-line mt-6 border-t pt-5">
            <h3 className="text-sm font-medium">Search Unsplash</h3>
            <p className="text-muted-foreground mt-2 text-xs">
                Find any image you have in mind. Your selections are illustrations, not verified location photos.
            </p>
            <form
                className="border-line mt-3 flex items-center gap-2 border-b"
                onSubmit={(event) => {
                    event.preventDefault();
                    void search();
                }}
            >
                <input
                    type="search"
                    aria-label="Search Unsplash"
                    maxLength={160}
                    value={query}
                    disabled={disabled}
                    placeholder="A place, food, landscape, anything..."
                    className="min-w-0 flex-1 bg-transparent py-3 text-sm outline-none"
                    onChange={(event) => {
                        pending.current?.abort();
                        setBusy(false);
                        setQuery(event.target.value);
                        setError("");
                        setResult(null);
                    }}
                />
                <button
                    type="submit"
                    disabled={busy || disabled || !query.trim()}
                    aria-label="Search photos"
                    className="editor-icon-action"
                >
                    <Search size={17} />
                </button>
            </form>
            {busy ? (
                <p role="status" className="mt-3 text-xs">
                    Finding photos...
                </p>
            ) : null}
            {error ? (
                <p role="alert" className="mt-3 text-xs text-red-600 dark:text-red-400">
                    {error}
                </p>
            ) : null}
            {result && !result.photos.length ? (
                <p role="status" className="mt-3 text-xs">
                    No photos found. Try another search.
                </p>
            ) : null}
            <ul className="mt-4 grid grid-cols-2 gap-4">
                {result?.photos.map((photo, index) => (
                    <li key={photo.id} className="group/photo min-w-0">
                        <button
                            type="button"
                            aria-label={`Enlarge ${photo.alt}`}
                            onClick={() => onPreview(result!.photos, index)}
                            className="editor-photo-card block w-full overflow-hidden rounded-xl"
                        >
                            <img
                                src={photo.thumbnailUrl}
                                alt={photo.alt}
                                loading="lazy"
                                draggable={false}
                                className="aspect-square w-full object-cover"
                            />
                        </button>
                        <button
                            type="button"
                            disabled={busy || disabled || selectedIds.includes(photo.id)}
                            onClick={() => void select(photo)}
                            className="mt-2 inline-flex min-h-9 items-center gap-2 text-xs disabled:opacity-50"
                        >
                            <Plus size={14} />
                            {selectedIds.includes(photo.id) ? "Added" : "Add photo"}
                        </button>
                        <a
                            href={photo.photographerUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-muted-foreground block truncate text-[10px] underline"
                        >
                            Photo by {photo.photographer}
                        </a>
                    </li>
                ))}
            </ul>
            {result && result.totalPages > 0 ? (
                <div className="mt-4 flex items-center justify-between gap-2 text-xs">
                    <button
                        type="button"
                        disabled={busy || disabled || result.page <= 1}
                        onClick={() => void search(result.page - 1, result.query)}
                        className="min-h-10 disabled:opacity-30"
                    >
                        &larr; Previous
                    </button>
                    <span>
                        Page {result.page} of {result.totalPages} · {result.total} results
                    </span>
                    <button
                        type="button"
                        disabled={busy || disabled || result.page >= result.totalPages}
                        onClick={() => void search(result.page + 1, result.query)}
                        className="min-h-10 disabled:opacity-30"
                    >
                        Next &rarr;
                    </button>
                </div>
            ) : null}
        </section>
    );
}
