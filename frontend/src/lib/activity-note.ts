import { commentLength } from "./board-comments";

export const activityNoteLimit = 250;
export const activityNoteLength = (note: string): number => commentLength(note);

export function activityNoteError(note: string, original = ""): string | null {
    return note !== original && activityNoteLength(note) > activityNoteLimit
        ? "Keep edited activity notes within 250 characters. Your text has not been shortened."
        : null;
}
