import type { PhotoBoardCardData } from "@/types/board-card";
import type { SelectionBoard } from "./board-selection";
import type { GalleryBoard } from "./my-boards";
import { findCountry } from "./countries";

export type DiscoveryCard = {
    boardId: number;
    title: string;
    description: string;
    status: "draft" | "published";
    visibility: "public" | "friends" | "collaborators";
    owner: { username: string; displayName: string; photoUrl: string | null };
    destination: { name: string; city: string | null; country: string | null; address: string | null } | null;
    coverImageUrl: string | null;
    tags: string[];
    durationDays: number;
    activityCount: number;
    savedCount: number;
    savedByMe: boolean;
    firstPublishedAt: string | null;
    updatedAt: string;
    savedAt?: string;
    permissions: { canEditContent: boolean; canManageBoard: boolean };
};
export type DiscoveryResult = {
    items: DiscoveryCard[];
    page?: number;
    limit?: number;
    total?: number;
    hasMore?: boolean;
    location?: { label: string; term: string } | null;
};
const origin = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001").replace(/\/+$/, "");
export class DiscoveryApiError extends Error {
    constructor(
        message: string,
        public readonly status: number
    ) {
        super(message);
        this.name = "DiscoveryApiError";
    }
}
export async function discoveryRequest<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${origin}/api/v1${path}`, {
        ...init,
        credentials: "include",
        cache: "no-store",
        headers: { ...(init?.body ? { "Content-Type": "application/json" } : {}), ...init?.headers }
    });
    const body = (await response.json().catch(() => ({}))) as { data?: T; error?: { message: string } };
    if (!response.ok || body.data === undefined)
        throw new DiscoveryApiError(body.error?.message ?? "Boards could not be loaded. Try again.", response.status);
    return body.data;
}
const absolute = (url: string | null) => (url ? new URL(url, origin).toString() : undefined);
export function discoveryPhoto(board: DiscoveryCard): PhotoBoardCardData {
    const country = board.destination?.country ? findCountry(board.destination.country) : undefined;
    return {
        id: String(board.boardId),
        title: board.title || "Untitled Board",
        author: board.owner.username,
        authorPhotoUrl: absolute(board.owner.photoUrl),
        destination: [
            ...new Set([board.destination?.name, country?.name ?? board.destination?.country].filter(Boolean))
        ].join(", "),
        destinationLabel: country?.code ?? board.destination?.country ?? "",
        image: board.coverImageUrl
            ? { src: absolute(board.coverImageUrl)!, alt: `Cover of ${board.title}` }
            : undefined,
        tags: board.tags,
        description: board.description,
        durationDays: board.durationDays,
        activityCount: board.activityCount,
        savedCount: board.savedCount,
        status: board.status,
        visibility: board.visibility
    };
}
export function discoverySelection(
    board: DiscoveryCard,
    source: "owned" | "saved" | "shared" = "shared"
): SelectionBoard {
    const photo = discoveryPhoto(board);
    return {
        summary: {
            boardId: board.boardId,
            title: board.title,
            status: board.status,
            visibility: board.visibility,
            source,
            coverImageUrl: board.coverImageUrl,
            updatedAt: source === "saved" ? (board.savedAt ?? board.updatedAt) : board.updatedAt
        },
        photo,
        destination: photo.destination,
        ownership: board.permissions.canManageBoard ? "owner" : "other",
        previewResolved: true,
        savedByMe: board.savedByMe,
        firstPublishedAt: board.firstPublishedAt,
        editHref: board.permissions.canEditContent
            ? board.status === "draft"
                ? `/boards/drafts/${board.boardId}`
                : `/boards/${board.boardId}/edit`
            : undefined,
        collage: {
            ...photo,
            images: photo.image ? [photo.image] : [],
            durationDays: board.durationDays,
            description: board.description,
            themes: board.tags,
            highlights: []
        }
    };
}
export function discoveryGallery(board: DiscoveryCard): GalleryBoard {
    const selected = discoverySelection(board);
    return {
        collage: selected.collage,
        photo: selected.photo,
        ownership: selected.ownership,
        href: board.status === "draft" ? selected.editHref : `/boards/${board.boardId}`,
        editHref: selected.editHref,
        savedByMe: board.savedByMe,
        compact: { ...selected.photo, image: selected.photo.image ?? { src: "", alt: "" } }
    };
}
export function boardsSearchHref(query: string, page = 1, location: "auto" | "off" = "auto", geography = "") {
    const params = new URLSearchParams(geography);
    params.set("q", query.trim());
    params.set("page", String(page));
    if (location === "off") params.set("location", "off");
    return `/boards?${params}`;
}

export type DiscoveryState = { key: string; data: DiscoveryResult | null; loading: boolean; error: string };
// Each section owns its request state. Failed pagination preserves loaded results and retries the same page.
export function createDiscoveryStore() {
    const listeners = new Set<() => void>();
    const state = { value: { key: "", data: null, loading: false, error: "" } as DiscoveryState, generation: 0 };
    const emit = (value: DiscoveryState) => {
        state.value = value;
        listeners.forEach((listener) => listener());
    };
    return {
        subscribe(listener: () => void) {
            listeners.add(listener);
            return () => {
                listeners.delete(listener);
            };
        },
        getSnapshot: () => state.value,
        cancel() {
            state.generation += 1;
        },
        removeConfirmed(boardId: number) {
            state.generation += 1;
            emit({
                ...state.value,
                loading: false,
                error: "",
                data: state.value.data
                    ? {
                          ...state.value.data,
                          hasMore: false,
                          items: state.value.data.items.filter((board) => board.boardId !== boardId)
                      }
                    : null
            });
        },
        async load(path: string, append = false, retain = false) {
            const generation = ++state.generation;
            const previous = append || retain ? state.value.data : null;
            emit({ key: path, data: previous, loading: true, error: "" });
            try {
                const data = await discoveryRequest<DiscoveryResult>(path);
                if (generation !== state.generation) return;
                emit({
                    key: path,
                    loading: false,
                    error: "",
                    data: {
                        ...data,
                        items: [
                            ...new Map(
                                [...(append ? (previous?.items ?? []) : []), ...data.items].map((board) => [
                                    board.boardId,
                                    board
                                ])
                            ).values()
                        ]
                    }
                });
            } catch (error) {
                if (generation === state.generation)
                    emit({
                        key: path,
                        data: error instanceof DiscoveryApiError && [401, 403].includes(error.status) ? null : previous,
                        loading: false,
                        error: error instanceof Error ? error.message : "Boards could not be loaded."
                    });
            }
        }
    };
}
