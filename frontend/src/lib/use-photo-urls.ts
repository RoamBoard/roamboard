"use client";
import { useSyncExternalStore } from "react";
const revisions = new Map<number, number>();
const listeners = new Set<() => void>();
const state = { version: 0 };
export function photoWasEdited(imageId: number, revision: number) {
    revisions.set(imageId, revision);
    state.version++;
    listeners.forEach((listener) => listener());
}
export function usePhotoUrls() {
    useSyncExternalStore(
        (listener) => {
            listeners.add(listener);
            return () => {
                listeners.delete(listener);
            };
        },
        () => state.version,
        () => 0
    );
    return (url: string) => {
        const match = url.match(/\/api\/v1\/images\/(\d+)\/content/);
        const revision = match ? revisions.get(Number(match[1])) : undefined;
        if (revision === undefined) return url;
        const parsed = new URL(url, process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001");
        parsed.searchParams.set("v", String(revision));
        return parsed.toString();
    };
}
