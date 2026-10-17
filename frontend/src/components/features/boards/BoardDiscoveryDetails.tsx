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
            <fieldset disabled={disabled || !canChangeVisibility} aria-describedby="board-visibility-help">
                <legend className="text-foreground/80 text-20 font-bold">Visibility</legend>
                <p id="board-visibility-help" className="text-muted-foreground mt-3 max-w-lg text-xs leading-relaxed">
                    Choose who can see the published Board. Drafts remain visible only to you.
                </p>
                <div className="mt-6 grid gap-4 sm:grid-cols-3 sm:gap-5">
                    {(
                        [
                            ["collaborators", "Collaborators", "You and invited Board members"],
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
                                onChange={() => {
                                    if (!disabled && canChangeVisibility) onVisibilityChange(value);
                                }}
                                className="peer sr-only"
                            />
                            <span className="border-line text-muted-foreground peer-checked:border-foreground/60 peer-checked:text-foreground/80 peer-focus-visible:outline-foreground flex min-h-20 w-full items-center gap-3 border-l px-4 py-3 transition-colors peer-checked:border-y peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-disabled:cursor-not-allowed peer-disabled:opacity-60 motion-reduce:transition-none">
                                <CreatorDetailIcon name={value} />
                                <span className="min-w-0">
                                    <strong className="block text-xs font-medium">{label}</strong>
                                    <span className="text-muted-foreground mt-1 block text-[10px] leading-relaxed">
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
