"use client";

import { useState, type FormEvent } from "react";
import type { Board, BoardActivity } from "@/types/board";
import { savePreviewCopy } from "@/lib/board-preview";

type Props = {
    sourceBoardId: string;
    initialDraft: Board;
    onSaved: (draft: Board) => void;
};

// All editor fields use these styles.
const fieldClasses =
    "border-line bg-background w-full border px-3 py-2 text-14 focus-visible:outline-2 focus-visible:outline-offset-2";

// Edit a preview copy without changing the published board.
export default function BoardCopyEditor({
    sourceBoardId,
    initialDraft,
    onSaved
}: Props) {
    // Keep edits here until the user presses Save preview copy.
    const [draft, setDraft] = useState(initialDraft);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");

    // Replace the edited activity while leaving the other items as they are.
    function updateActivity(
        activityId: string,
        changes: Partial<BoardActivity>
    ) {
        setDraft((currentDraft) => ({
            ...currentDraft,
            items: currentDraft.items.map((item) =>
                item.type === "activity" && item.id === activityId
                    ? { ...item, ...changes }
                    : item
            )
        }));
    }

    // Handle the save here so submitting the form does not reload the page.
    function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setMessage("");
        setError("");
        // A title made of spaces should count as empty too.
        if (!draft.title.trim()) {
            setError("Enter a title for your copy.");
            return;
        }
        if (
            draft.items.some(
                (item) => item.type === "activity" && !item.title.trim()
            )
        ) {
            setError("Each activity needs a title.");
            return;
        }
        try {
            // Keep the duration long enough to include the last numbered day.
            const saved = {
                ...draft,
                title: draft.title.trim(),
                durationDays: Math.max(
                    draft.durationDays ?? 0,
                    ...draft.items.map((item) => item.dayNumber ?? 1)
                ),
                updatedAt: new Date().toISOString()
            };
            // Store this copy in the tab, then give the updated draft to the parent.
            savePreviewCopy(sourceBoardId, saved);
            onSaved(saved);
            setMessage(
                "Preview copy saved in this tab. The original board is unchanged."
            );
        } catch {
            setError(
                "This browser could not save the preview copy. Your edits are still here; try again."
            );
        }
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <p className="text-muted-foreground text-14">
                Preview only. This is your editable copy, stored in this browser
                tab. It is not saved to an account or database. Closing the tab
                clears it.
            </p>
            <label className="block space-y-2">
                <span className="text-14">Board title</span>
                <input
                    required
                    value={draft.title}
                    onChange={(event) =>
                        setDraft({ ...draft, title: event.target.value })
                    }
                    className={fieldClasses}
                />
            </label>
            <label className="block space-y-2">
                <span className="text-14">Description</span>
                <textarea
                    rows={4}
                    value={draft.description}
                    onChange={(event) =>
                        setDraft({ ...draft, description: event.target.value })
                    }
                    className={fieldClasses}
                />
            </label>
            <fieldset className="space-y-5">
                <legend className="font-display text-24 mb-4 font-bold">
                    Your activities
                </legend>
                {draft.items.map((item, index) => {
                    // Non-activity items stay in the copy, but have no editing fields yet.
                    if (item.type !== "activity") {
                        return (
                            <p
                                key={item.id}
                                className="text-muted-foreground text-14"
                            >
                                {item.type === "location"
                                    ? item.location.name
                                    : item.type === "text"
                                      ? item.text
                                      : item.image.alt}
                                <span className="text-12 block">
                                    Included in your copy.
                                </span>
                            </p>
                        );
                    }
                    return (
                        <fieldset
                            key={item.id}
                            className="border-line grid gap-3 border-t pt-5 sm:grid-cols-2"
                        >
                            <legend className="text-muted-foreground text-12 px-1">
                                Activity {index + 1}
                            </legend>
                            <label className="space-y-1 sm:col-span-2">
                                <span className="text-14">Title</span>
                                <input
                                    required
                                    value={item.title}
                                    onChange={(event) =>
                                        updateActivity(item.id, {
                                            title: event.target.value
                                        })
                                    }
                                    className={fieldClasses}
                                />
                            </label>
                            <label className="space-y-1">
                                <span className="text-14">Day</span>
                                <input
                                    type="number"
                                    min={1}
                                    step={1}
                                    required
                                    value={item.dayNumber ?? 1}
                                    onChange={(event) =>
                                        updateActivity(item.id, {
                                            dayNumber: Number(
                                                event.target.value
                                            )
                                        })
                                    }
                                    className={fieldClasses}
                                />
                            </label>
                            <label className="space-y-1">
                                <span className="text-14">Time (optional)</span>
                                <input
                                    type="time"
                                    value={item.time ?? ""}
                                    onChange={(event) =>
                                        updateActivity(item.id, {
                                            time:
                                                event.target.value || undefined
                                        })
                                    }
                                    className={fieldClasses}
                                />
                            </label>
                            <label className="space-y-1 sm:col-span-2">
                                <span className="text-14">Notes</span>
                                <textarea
                                    rows={3}
                                    value={item.description}
                                    onChange={(event) =>
                                        updateActivity(item.id, {
                                            description: event.target.value
                                        })
                                    }
                                    className={fieldClasses}
                                />
                            </label>
                        </fieldset>
                    );
                })}
            </fieldset>
            <button
                type="submit"
                className="border-line hover:bg-faint text-14 min-h-11 cursor-pointer border px-6 py-2 focus-visible:outline-2 focus-visible:outline-offset-4"
            >
                Save preview copy
            </button>
            <p role="status" className="text-muted-foreground text-14">
                {message}
            </p>
            {error ? (
                <p role="alert" className="text-14">
                    {error}
                </p>
            ) : null}
        </form>
    );
}
