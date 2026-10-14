"use client";

import { useState, useSyncExternalStore } from "react";
import {
    addActivityToPreviewCopy,
    createPreviewCopy,
    isPreviewActivitySaved,
    isPreviewBoardSaved,
    readPreviewCopy,
    setPreviewActivitySaved,
    setPreviewBoardSaved,
    subscribeToPreviewChanges
} from "@/lib/board-preview";
import type { Board, BoardActivity } from "@/types/board";

// This hook contains preview saving/copying. Popup selection stays in PublishedBoard.
export default function useBoardPreview(board: Board, selectedActivity: BoardActivity | null) {
    // Storage is unavailable on the server. These subscriptions read it in the
    // browser and keep the bookmark buttons in sync after saving or refreshing.
    const boardSaved = useSyncExternalStore(
        subscribeToPreviewChanges,
        () => {
            try {
                return isPreviewBoardSaved(board.id);
            } catch {
                return false;
            }
        },
        () => false
    );
    const activitySaved = useSyncExternalStore(
        subscribeToPreviewChanges,
        () => {
            try {
                return selectedActivity ? isPreviewActivitySaved(board.id, selectedActivity.id) : false;
            } catch {
                return false;
            }
        },
        () => false
    );
    // A draft opens the copy editor. null means the editor is closed.
    const [draft, setDraft] = useState<Board | null>(null);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");

    // Remove the previous action's message before starting another action.
    function clearFeedback() {
        setMessage("");
        setError("");
    }

    // Pressing the bookmark again removes the saved marker.
    function saveBoard() {
        clearFeedback();
        try {
            const saved = !isPreviewBoardSaved(board.id);
            setPreviewBoardSaved(board.id, saved);
            setMessage(
                saved ? "Board bookmarked in this tab for the preview." : "Board bookmark removed from this tab."
            );
        } catch {
            setError("This browser could not save the preview bookmark. Please try again.");
        }
    }

    // Reopen a saved copy if there is one, otherwise start with a fresh copy.
    function copyBoard() {
        clearFeedback();
        try {
            setDraft(readPreviewCopy(board.id) ?? createPreviewCopy(board));
        } catch {
            setDraft(createPreviewCopy(board));
            setError("The earlier preview copy could not be read. A new copy is open; it has not been saved.");
        }
    }

    // Store or remove the selected activity in this tab.
    function saveActivity() {
        if (!selectedActivity) return;
        clearFeedback();
        try {
            const saved = !isPreviewActivitySaved(board.id, selectedActivity.id);
            setPreviewActivitySaved(board.id, selectedActivity, saved);
            setMessage(
                saved
                    ? "Activity saved in this tab for the preview."
                    : "Activity removed from this tab's saved preview."
            );
        } catch {
            setError("This browser could not save the activity preview. Please try again.");
        }
    }

    // Return true so the page knows it can close the activity popup.
    function copyActivity(): boolean {
        if (!selectedActivity) return false;
        clearFeedback();
        try {
            setDraft(addActivityToPreviewCopy(board, selectedActivity, readPreviewCopy(board.id)));
            return true;
        } catch {
            setError("The preview copy could not be opened. Please try again.");
            return false;
        }
    }

    // The page uses these values and functions to connect its buttons and popups.
    return {
        boardSaved,
        activitySaved,
        draft,
        setDraft,
        message,
        error,
        clearFeedback,
        saveBoard,
        copyBoard,
        saveActivity,
        copyActivity
    };
}
