import { ProfileApiError, saveBoardBookmark, unsaveBoardBookmark } from "./profile";

type BoardSaveState = {
    saved: boolean | undefined;
    pending: boolean;
    message: string;
    error: string;
    signInRequired: boolean;
};

// One card/account resource. No global cache, inferred membership, or document fetch.
export function createBoardSaveStore(boardId: number, initialSaved: boolean | undefined) {
    const listeners = new Set<() => void>();
    const state = {
        current: {
            saved: initialSaved,
            pending: false,
            message: "",
            error: "",
            signInRequired: false
        } as BoardSaveState
    };
    const update = (next: BoardSaveState) => {
        state.current = next;
        listeners.forEach((listener) => listener());
    };
    return {
        getSnapshot: () => state.current,
        subscribe(listener: () => void) {
            listeners.add(listener);
            return () => {
                listeners.delete(listener);
            };
        },
        async toggle() {
            const previous = state.current;
            if (previous.pending || previous.saved === undefined) return;
            update({ ...previous, pending: true, message: "", error: "", signInRequired: false });
            try {
                if (previous.saved) await unsaveBoardBookmark(boardId);
                else {
                    const result = await saveBoardBookmark(boardId);
                    if (result.boardId !== boardId || result.saved !== true)
                        throw new Error("The server did not confirm this Board was saved. Try again.");
                }
                update({
                    saved: !previous.saved,
                    pending: false,
                    error: "",
                    signInRequired: false,
                    message: previous.saved
                        ? "Board removed from your saved collection."
                        : "Board saved to your collection."
                });
            } catch (caught) {
                const signInRequired = caught instanceof ProfileApiError && caught.status === 401;
                update({
                    ...previous,
                    pending: false,
                    message: "",
                    signInRequired,
                    error: signInRequired
                        ? "Sign in to save this Board."
                        : caught instanceof Error
                          ? caught.message
                          : "The Board could not be saved. Try again."
                });
            }
        }
    };
}
