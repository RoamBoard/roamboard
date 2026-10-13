import type { Board, BoardActivity } from "@/types/board";

// Temporary, tab-local persistence. Replace these functions with authenticated
// backend mutations when save/copy endpoints have been agreed and implemented.
const prefix = "roamboard:published-board-preview:";

export function subscribeToPreviewChanges(onChange: () => void): () => void {
    window.addEventListener("storage", onChange);
    window.addEventListener("roamboard-preview-change", onChange);
    return () => {
        window.removeEventListener("storage", onChange);
        window.removeEventListener("roamboard-preview-change", onChange);
    };
}

export function isPreviewBoardSaved(boardId: string): boolean {
    return sessionStorage.getItem(`${prefix}saved:${boardId}`) === "true";
}

export function setPreviewBoardSaved(boardId: string, saved: boolean): void {
    sessionStorage.setItem(`${prefix}saved:${boardId}`, String(saved));
    window.dispatchEvent(new Event("roamboard-preview-change"));
}

export function isPreviewActivitySaved(
    boardId: string,
    activityId: string
): boolean {
    return (
        sessionStorage.getItem(`${prefix}activity:${boardId}:${activityId}`) !==
        null
    );
}

export function setPreviewActivitySaved(
    boardId: string,
    activity: BoardActivity,
    saved: boolean
): void {
    const key = `${prefix}activity:${boardId}:${activity.id}`;
    if (saved) sessionStorage.setItem(key, JSON.stringify(activity));
    else sessionStorage.removeItem(key);
    window.dispatchEvent(new Event("roamboard-preview-change"));
}

export function readPreviewCopy(boardId: string): Board | null {
    const stored = sessionStorage.getItem(`${prefix}copy:${boardId}`);
    if (!stored) return null;
    const board = JSON.parse(stored) as Board;
    if (!Array.isArray(board.items) || typeof board.title !== "string") {
        throw new Error("The preview copy could not be read.");
    }
    return board;
}

export function savePreviewCopy(sourceBoardId: string, draft: Board): void {
    sessionStorage.setItem(
        `${prefix}copy:${sourceBoardId}`,
        JSON.stringify(draft)
    );
}

export function createPreviewCopy(board: Board): Board {
    const copy = structuredClone(board);
    const now = new Date().toISOString();
    return {
        ...copy,
        id: `preview-${crypto.randomUUID()}`,
        ownerId: "preview-owner",
        visibility: "private",
        isCompleted: false,
        items: copy.items.map((item) => ({
            ...item,
            id: `preview-${crypto.randomUUID()}`
        })),
        createdAt: now,
        updatedAt: now
    };
}

export function addActivityToPreviewCopy(
    source: Board,
    activity: BoardActivity,
    existing: Board | null
): Board {
    const draft = existing ?? createPreviewCopy(source);
    const copied: BoardActivity = {
        ...structuredClone(activity),
        id: `preview-${crypto.randomUUID()}`,
        dayNumber: existing ? (activity.dayNumber ?? 1) : 1
    };
    return {
        ...draft,
        title: existing ? draft.title : `${activity.title} trip`,
        description: existing ? draft.description : "",
        durationDays: Math.max(
            existing?.durationDays ?? 1,
            copied.dayNumber ?? 1
        ),
        dayTitles: existing?.dayTitles,
        items: existing ? [...draft.items, copied] : [copied],
        updatedAt: new Date().toISOString()
    };
}
