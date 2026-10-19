import { toBoardWrite } from "./board-creator-api";
import type { BoardCreatorPayload } from "@/types/board-creator";

export type BoardLeaveNavigation = "back" | "replace" | "push";

// Compare persisted meaning, not transient editor IDs or refreshed protected-image URLs.
export function boardEditorFingerprint(board: BoardCreatorPayload): string {
    const write = toBoardWrite(
        board,
        board.tags.map((name, index) => ({ name, tagId: index }))
    );
    return JSON.stringify({
        ...write,
        status: undefined,
        tags: [...board.tags].sort(),
        days: write.days.map((day) => ({
            ...day,
            dayId: undefined,
            activities: day.activities.map((activity) => ({ ...activity, activityId: undefined }))
        }))
    });
}

export function shouldConfirmBoardNavigation(
    event: Pick<MouseEvent, "button" | "defaultPrevented" | "metaKey" | "ctrlKey" | "shiftKey" | "altKey">,
    anchor: { href: string; target: string; download: boolean },
    currentURL: string
): boolean {
    if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
    )
        return false;
    if (anchor.download || (anchor.target && anchor.target.toLowerCase() !== "_self")) return false;
    const current = new URL(currentURL);
    const destination = new URL(anchor.href, current);
    // Cross-document/external navigation is covered by beforeunload; do not show two prompts.
    if (destination.origin !== current.origin || !["http:", "https:"].includes(destination.protocol)) return false;
    return destination.pathname !== current.pathname || destination.search !== current.search;
}
