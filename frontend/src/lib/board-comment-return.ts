const boardReturnPattern = /^\/boards\/[1-9]\d*(?:#comments)?$/;

export function validatedBoardCommentReturnPath(value: string | null): string | null {
    return value && boardReturnPattern.test(value) ? value : null;
}

export function loginDestinationAfterBoardComment(fallback: string): string {
    if (typeof window === "undefined") return fallback;
    return validatedBoardCommentReturnPath(new URLSearchParams(window.location.search).get("returnTo")) ?? fallback;
}
