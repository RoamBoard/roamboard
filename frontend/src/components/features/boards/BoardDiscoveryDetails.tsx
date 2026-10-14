"use client";

import TokenField from "@/components/features/boards/TokenField";
import type { BoardCreatorPayload } from "@/types/board-creator";

type Props = {
    tags: string[];
    allowedTags: string[];
    visibility: BoardCreatorPayload["visibility"];
    canChangeVisibility?: boolean;
    onTagsChange: (values: string[]) => void;
    onVisibilityChange: (visibility: BoardCreatorPayload["visibility"]) => void;
};

export default function BoardDiscoveryDetails({
    tags,
    allowedTags,
    visibility,
    canChangeVisibility = true,
    onTagsChange,
    onVisibilityChange
}: Props) {
    return (
        <div className="grid gap-14">
            <TokenField
                id="board-tags"
                label="Tags"
                values={tags}
                placeholder="Search allowed tags +"
                maximum={3}
                suggestions={allowedTags}
                allowCustom={false}
                onChange={onTagsChange}
            />

            <fieldset>
                <legend className="font-display text-20 font-bold">Visibility</legend>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    {(
                        [
                            ["collaborators", "Collaborators", "Visible to you and invited Board members"],
                            ["friends", "Friends", "Visible to you and your friends"],
                            ["public", "Public", "Discoverable by everyone"]
                        ] as const
                    ).map(([value, label, description]) => (
                        <label
                            key={value}
                            className={`cursor-pointer border p-4 ${visibility === value ? "border-foreground" : "border-line"}`}
                        >
                            <input
                                type="radio"
                                name="visibility"
                                value={value}
                                checked={visibility === value}
                                disabled={!canChangeVisibility}
                                onChange={() => onVisibilityChange(value)}
                                className="sr-only"
                            />
                            <strong className="text-13 block font-medium">{label}</strong>
                            <span className="text-10 text-graphite mt-1 block">{description}</span>
                        </label>
                    ))}
                </div>
                {!canChangeVisibility ? (
                    <p className="text-12 text-graphite mt-3">Only the Board owner can change visibility.</p>
                ) : null}
            </fieldset>
        </div>
    );
}
