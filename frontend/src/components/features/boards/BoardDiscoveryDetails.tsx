"use client";

import BoardTagPicker from "@/components/features/boards/BoardTagPicker";
import CreatorDetailIcon from "@/components/features/boards/CreatorDetailIcon";
import type { BoardCreatorPayload } from "@/types/board-creator";

type Props = {
    tags: string[];
    allowedTags: string[];
    visibility: BoardCreatorPayload["visibility"];
    canChangeVisibility?: boolean;
    disabled?: boolean;
    tagsLoading?: boolean;
    tagsError?: string;
    onRetryTags?: () => void;
    onTagsChange: (values: string[]) => void;
    onVisibilityChange: (visibility: BoardCreatorPayload["visibility"]) => void;
};

export default function BoardDiscoveryDetails({
    tags,
    allowedTags,
    visibility,
    canChangeVisibility = true,
    disabled = false,
    tagsLoading = false,
    tagsError = "",
    onRetryTags,
    onTagsChange,
    onVisibilityChange
}: Props) {
    return (
        <div className="grid min-w-0 gap-20 sm:gap-28">
            <BoardTagPicker
                values={tags}
                suggestions={allowedTags}
                onChange={onTagsChange}
                disabled={disabled}
                loading={tagsLoading}
                error={tagsError}
                onRetry={onRetryTags}
            />
            <fieldset
                id="board-visibility"
                tabIndex={-1}
                disabled={disabled || !canChangeVisibility}
                aria-describedby="board-visibility-help"
                className="scroll-mt-36"
            >
                <legend className="text-foreground/80 text-20 flex items-center gap-3 font-bold">
                    <span>Visibility</span>
                    <button
                        type="button"
                        title="Drafts stay visible only to you. Published private Boards can also be read by invited members."
                        aria-label="Visibility information"
                        aria-describedby="board-visibility-help"
                        className="focus-visible:outline-foreground inline-flex rounded-full focus-visible:outline-2 focus-visible:outline-offset-2"
                    >
                        <CreatorDetailIcon name="information" />
                    </button>
                </legend>
                <p id="board-visibility-help" className="sr-only">
                    Drafts stay visible only to you. Published private Boards can also be read by invited members.
                </p>
                <div className="mt-6 grid gap-4 sm:grid-cols-3 sm:gap-0">
                    {(
                        [
                            ["collaborators", "Private", "You and invited Board members"],
                            ["friends", "Friends", "You, Board members, and your friends"],
                            ["public", "Public", "Discoverable by everyone"]
                        ] as const
                    ).map(([value, label, description]) => (
                        <label key={value} className="group relative flex min-w-0 cursor-pointer">
                            <input
                                type="radio"
                                name="visibility"
                                value={value}
                                checked={visibility === value}
                                disabled={disabled || !canChangeVisibility}
                                onClick={() => {
                                    if (visibility === value && !disabled && canChangeVisibility)
                                        onVisibilityChange(value);
                                }}
                                onChange={() => {
                                    if (!disabled && canChangeVisibility) onVisibilityChange(value);
                                }}
                                className="peer sr-only"
                            />
                            <span className="border-line text-muted-foreground peer-checked:border-foreground/60 peer-checked:text-foreground/80 peer-focus-visible:outline-foreground flex min-h-[88px] w-full items-center gap-4 border-l px-6 py-4 transition-colors peer-checked:border-y peer-checked:border-r peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-disabled:cursor-not-allowed peer-disabled:opacity-60 motion-reduce:transition-none sm:px-6">
                                <CreatorDetailIcon name={value} />
                                <span className="min-w-0">
                                    <strong className="block text-sm font-medium">{label}</strong>
                                    <span className="text-muted-foreground mt-0.5 block text-xs leading-snug">
                                        {description}
                                    </span>
                                </span>
                            </span>
                        </label>
                    ))}
                </div>
                {!canChangeVisibility ? (
                    <p className="text-muted-foreground mt-4 text-xs">Only the Board owner can change visibility.</p>
                ) : null}
            </fieldset>
        </div>
    );
}
