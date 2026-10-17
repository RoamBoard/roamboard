"use client";

import { useState, useMemo } from "react";
import { boardTags, type BoardTag } from "@/data/board-tags";
import TagIcon from "@/components/ui/TagIcon";

type Props = {
    selectedTags: string[];
    onChange: (tags: string[]) => void;
    maxTags?: number;
    className?: string;
};

export default function ProfileTagSelector({ selectedTags, onChange, maxTags = 10, className = "" }: Props) {
    const [searchQuery, setSearchQuery] = useState("");

    const activeTags = useMemo(() => {
        return selectedTags.map((name) => ({ name, catalogTag: boardTags.find((tag) => tag.name === name) }));
    }, [selectedTags]);

    const activeTagNames = useMemo(() => new Set(selectedTags), [selectedTags]);

    // Filter catalog tags based on search query
    const filteredTags = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        if (!query) return boardTags;
        return boardTags.filter(
            (tag) =>
                tag.name.toLowerCase().includes(query) ||
                tag.id.toLowerCase().includes(query) ||
                tag.description.toLowerCase().includes(query)
        );
    }, [searchQuery]);

    const isMaxReached = selectedTags.length >= maxTags;

    function handleToggleTag(tag: BoardTag) {
        if (activeTagNames.has(tag.name)) {
            onChange(selectedTags.filter((name) => name !== tag.name));
        } else {
            if (isMaxReached) return;
            onChange([...selectedTags, tag.name]);
        }
    }

    function handleRemoveTag(name: string) {
        onChange(selectedTags.filter((selected) => selected !== name));
    }

    return (
        <div className={`space-y-4 ${className}`}>
            {/* Header: Title and Selection Counter (matches Languages Spoken style) */}
            <div>
                <div className="flex items-center justify-between">
                    <h2 className="font-display text-16 text-foreground font-bold tracking-tight uppercase">Tags</h2>
                    <span className="text-11 text-muted-foreground font-medium">
                        ({selectedTags.length}/{maxTags})
                    </span>
                </div>
                <p className="text-12 text-muted-foreground mt-0.5">
                    Tags that describe your favorite types of activities and trips.
                </p>
            </div>

            {/* Currently Selected Tags: Rendered cleanly right on the card surface */}
            {activeTags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    {activeTags.map((tag) => (
                        <span
                            key={tag.name}
                            className="border-line bg-faint text-12 text-foreground font-body flex items-center gap-1.5 rounded-[2px] border px-2.5 py-1 font-medium"
                        >
                            {tag.catalogTag && (
                                <TagIcon tag={tag.catalogTag} size={13} className="text-foreground shrink-0" />
                            )}
                            <span>{tag.name}</span>
                            <button
                                type="button"
                                onClick={() => handleRemoveTag(tag.name)}
                                aria-label={`Remove ${tag.name}`}
                                className="text-muted-foreground hover:text-foreground cursor-pointer text-xs leading-none"
                            >
                                ✕
                            </button>
                        </span>
                    ))}
                </div>
            )}

            {/* Tag Search and Catalog Pill Cloud */}
            <div className="pt-2">
                <div className="relative max-w-sm">
                    <input
                        type="text"
                        aria-label="Filter travel tags"
                        value={searchQuery}
                        disabled={isMaxReached}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={
                            isMaxReached
                                ? `Limit reached (${maxTags} max)`
                                : "Filter catalog (e.g. Hiking, Foodie, Beach)..."
                        }
                        className="border-line text-12 text-foreground placeholder:text-muted-foreground font-body focus:border-foreground bg-background w-full rounded-[2px] border px-3 py-1.5 pr-7 transition-colors focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                    />
                    {searchQuery && (
                        <button
                            type="button"
                            onClick={() => setSearchQuery("")}
                            aria-label="Clear search"
                            className="text-muted-foreground hover:text-foreground absolute inset-y-0 right-0 flex cursor-pointer items-center pr-2.5 text-xs"
                        >
                            ✕
                        </button>
                    )}
                </div>

                {/* Pill Cloud */}
                <div className="mt-3 flex flex-wrap gap-1.5">
                    {filteredTags.length === 0 ? (
                        <p className="text-11 text-muted-foreground py-1 italic">
                            No tags match &ldquo;{searchQuery}&rdquo;.
                        </p>
                    ) : (
                        filteredTags.map((tag) => {
                            const isSelected = activeTagNames.has(tag.name);
                            const isDisabled = isMaxReached && !isSelected;

                            return (
                                <button
                                    key={tag.id}
                                    type="button"
                                    role="checkbox"
                                    aria-checked={isSelected}
                                    disabled={isDisabled}
                                    onClick={() => handleToggleTag(tag)}
                                    title={tag.description}
                                    className={`text-11 font-body flex items-center gap-1.5 rounded-[2px] border px-2.5 py-1 transition-colors ${
                                        isSelected
                                            ? "border-foreground bg-foreground text-background cursor-pointer font-medium"
                                            : isDisabled
                                              ? "border-line/60 bg-background text-muted-foreground/40 cursor-not-allowed opacity-40"
                                              : "border-line bg-background text-muted-foreground hover:border-foreground hover:text-foreground hover:bg-faint/40 cursor-pointer"
                                    }`}
                                >
                                    <TagIcon
                                        tag={tag}
                                        size={12}
                                        className={`shrink-0 ${
                                            isSelected ? "text-background" : "text-muted-foreground"
                                        }`}
                                    />
                                    <span>{tag.name}</span>
                                </button>
                            );
                        })
                    )}
                </div>

                {isMaxReached && (
                    <p className="text-11 text-muted-foreground font-body mt-2.5">Maximum of {maxTags} tags reached.</p>
                )}
            </div>
        </div>
    );
}
