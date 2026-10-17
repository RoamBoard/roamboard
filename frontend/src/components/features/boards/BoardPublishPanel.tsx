"use client";

import Link from "next/link";
import type { BoardDocument } from "@/lib/board-creator-api";
import type { BoardStatus } from "@/types/board-creator";

type Props = {
    expectedStatus: BoardStatus;
    savedBoard: BoardDocument | null;
    disabled: boolean;
    saving: BoardStatus | null;
    uploading: boolean;
    message: string;
    error: string;
    onSave: (status: BoardStatus) => void;
};

export default function BoardPublishPanel({
    expectedStatus,
    savedBoard,
    disabled,
    saving,
    uploading,
    message,
    error,
    onSave
}: Props) {
    const publishedEdit = expectedStatus === "published";
    const locked = disabled || saving !== null || uploading || (savedBoard?.status === "published" && !publishedEdit);
    return (
        <div className="[container-type:inline-size] min-w-0 text-center" aria-busy={saving !== null}>
            <p className="text-muted-foreground mx-auto mb-10 max-w-md text-xs leading-relaxed sm:text-sm">
                {publishedEdit
                    ? "Keep the journey up to date. Save your changes when you’re ready."
                    : "A plan worth sharing. Publish when you’re ready, or keep it as a draft for later."}
            </p>
            <button
                type="button"
                disabled={locked}
                aria-label={publishedEdit ? "Save changes" : "Publish Board"}
                onClick={() => {
                    if (!locked) onSave("published");
                }}
                className={`font-display hover:text-foreground/70 focus-visible:outline-foreground block min-h-16 w-full cursor-pointer py-3 leading-[1.02] font-bold tracking-[-0.045em] uppercase transition-colors focus-visible:outline-2 focus-visible:outline-offset-8 disabled:cursor-not-allowed disabled:opacity-35 motion-reduce:transition-none ${publishedEdit ? "text-[clamp(1.75rem,11cqw,7rem)]" : "text-[clamp(2rem,17cqw,9rem)]"}`}
            >
                {saving === "published"
                    ? publishedEdit
                        ? "Saving…"
                        : "Publishing…"
                    : publishedEdit
                      ? "Save changes"
                      : "PUBLISH"}
            </button>
            {!publishedEdit ? (
                <button
                    type="button"
                    disabled={locked}
                    onClick={() => {
                        if (!locked) onSave("draft");
                    }}
                    className="text-muted-foreground hover:text-foreground focus-visible:outline-foreground sm:text-24 mx-auto mt-6 block min-h-11 px-3 text-base underline underline-offset-8 focus-visible:outline-2 focus-visible:outline-offset-4 disabled:cursor-not-allowed disabled:opacity-35"
                >
                    {saving === "draft" ? "Saving draft..." : "Save as draft"}
                </button>
            ) : null}
            <p className="text-muted-foreground mx-auto mt-10 max-w-md text-[11px] leading-relaxed">
                {publishedEdit
                    ? "Changes use the visibility selected above. Only the Board owner can change visibility."
                    : "Drafts can stay incomplete and remain visible only to you. Publishing needs a title, at least one confirmed location, and confirmation of every photo suggestion."}
            </p>
            <p className="text-muted-foreground mx-auto mt-3 max-w-md text-[11px] leading-relaxed">
                Save before using your browser’s Back or Forward controls. This page does not save automatically.
            </p>
            <div
                id="board-save-feedback"
                tabIndex={-1}
                className="mx-auto mt-6 max-w-lg text-left text-xs leading-relaxed"
            >
                {saving !== null || uploading ? (
                    <p role="status" className="border-line border-l pl-4">
                        {uploading
                            ? "Images are uploading. Saving will be available when they finish."
                            : saving === "draft"
                              ? "Saving your draft…"
                              : publishedEdit
                                ? "Saving your changes…"
                                : "Publishing your Board…"}
                    </p>
                ) : null}
                {error ? (
                    <div role="alert" className="border-foreground border-l-2 pl-4">
                        <p className="break-words">{error}</p>
                        <div className="text-muted-foreground mt-3 flex flex-wrap gap-x-5">
                            <a
                                href="#board-title"
                                className="hover:text-foreground inline-flex min-h-11 items-center underline underline-offset-4"
                            >
                                Review title
                            </a>
                            <a
                                href="#day-plan"
                                className="hover:text-foreground inline-flex min-h-11 items-center underline underline-offset-4"
                            >
                                Review day plan
                            </a>
                        </div>
                        <p className="text-muted-foreground mt-2">
                            Your edits are still here. Resolve the issue and try again.
                        </p>
                    </div>
                ) : message && saving === null ? (
                    <p role="status" className="border-foreground border-l-2 pl-4">
                        {message}
                    </p>
                ) : null}
            </div>
            {savedBoard ? (
                <Link
                    href={`/boards/${savedBoard.boardId}`}
                    className="text-muted-foreground hover:text-foreground mt-6 inline-flex min-h-11 items-center px-2 text-xs underline underline-offset-4"
                >
                    View saved Board →
                </Link>
            ) : null}
        </div>
    );
}
