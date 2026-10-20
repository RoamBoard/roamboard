"use client";

import { useId, useMemo, useRef, useState } from "react";

type Props = {
    languages: string[];
    onChangeLanguages: (languages: string[]) => void;
    choices: string[];
    maxLanguages?: number;
};

export default function LanguageEditor({ languages, onChangeLanguages, choices, maxLanguages = 10 }: Props) {
    const [searchQuery, setSearchQuery] = useState("");
    const [isOpen, setIsOpen] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState(0);
    const listboxId = useId();
    const containerRef = useRef<HTMLDivElement>(null);

    const isMaxReached = languages.length >= maxLanguages;

    const availableChoices = useMemo(() => {
        const selectedSet = new Set(languages.map((l) => l.toLowerCase()));
        return choices.filter((choice) => !selectedSet.has(choice.toLowerCase()));
    }, [choices, languages]);

    const filteredChoices = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        if (!query) return availableChoices;
        return availableChoices.filter((choice) => choice.toLowerCase().includes(query));
    }, [availableChoices, searchQuery]);

    function handleAdd(languageToAdd: string) {
        if (isMaxReached) return;
        const canonical = availableChoices.find(
            (choice) => choice.toLowerCase() === languageToAdd.trim().toLowerCase()
        );
        if (canonical && !languages.includes(canonical)) {
            onChangeLanguages([...languages, canonical]);
            setSearchQuery("");
            setIsOpen(false);
            setHighlightedIndex(0);
        }
    }

    function handleRemove(item: string) {
        onChangeLanguages(languages.filter((l) => l !== item));
    }

    function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
        if (e.key === "ArrowDown") {
            e.preventDefault();
            if (!isOpen) {
                setIsOpen(true);
            } else if (filteredChoices.length > 0) {
                setHighlightedIndex((prev) => (prev + 1) % filteredChoices.length);
            }
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            if (!isOpen) {
                setIsOpen(true);
            } else if (filteredChoices.length > 0) {
                setHighlightedIndex((prev) => (prev - 1 + filteredChoices.length) % filteredChoices.length);
            }
        } else if (e.key === "Enter") {
            e.preventDefault();
            if (
                isOpen &&
                filteredChoices.length > 0 &&
                highlightedIndex >= 0 &&
                highlightedIndex < filteredChoices.length
            ) {
                handleAdd(filteredChoices[highlightedIndex]);
            } else if (searchQuery.trim()) {
                handleAdd(searchQuery.trim());
            }
        } else if (e.key === "Escape") {
            e.preventDefault();
            setIsOpen(false);
        }
    }

    function handleBlurCapture(e: React.FocusEvent<HTMLDivElement>) {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
            setIsOpen(false);
        }
    }

    return (
        <div className="border-line bg-background rounded-[2px] border p-6">
            <div className="flex items-center justify-between">
                <h2 className="font-display text-16 text-foreground font-bold tracking-tight uppercase">
                    Languages Spoken
                </h2>
                <span className="text-11 text-muted-foreground font-medium">
                    ({languages.length}/{maxLanguages})
                </span>
            </div>
            <p className="text-12 text-muted-foreground mt-0.5">
                Languages you can communicate in when collaborating on boards or meeting travelers.
            </p>

            {languages.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                    {languages.map((lang) => (
                        <span
                            key={lang}
                            className="border-line bg-faint text-12 text-foreground font-body flex items-center gap-1.5 rounded-[2px] border px-2.5 py-1 font-medium"
                        >
                            <span>{lang}</span>
                            <button
                                type="button"
                                onClick={() => handleRemove(lang)}
                                aria-label={`Remove ${lang}`}
                                className="text-muted-foreground hover:text-foreground cursor-pointer text-xs leading-none"
                            >
                                ✕
                            </button>
                        </span>
                    ))}
                </div>
            )}

            <div ref={containerRef} onBlurCapture={handleBlurCapture} className="relative mt-4 max-w-sm">
                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <input
                            type="text"
                            role="combobox"
                            aria-expanded={isOpen && !isMaxReached}
                            aria-controls={listboxId}
                            aria-autocomplete="list"
                            aria-label="Add language"
                            value={searchQuery}
                            disabled={isMaxReached}
                            onFocus={() => {
                                if (!isMaxReached) setIsOpen(true);
                            }}
                            onChange={(e) => {
                                setSearchQuery(e.target.value);
                                setIsOpen(true);
                                setHighlightedIndex(0);
                            }}
                            onKeyDown={handleKeyDown}
                            placeholder={
                                isMaxReached ? `Limit reached (${maxLanguages} max)` : "Search language to add…"
                            }
                            className="border-line bg-background text-12 text-foreground placeholder:text-muted-foreground font-body focus:border-foreground w-full rounded-[2px] border px-3 py-1.5 pr-7 transition-colors focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                onClick={() => {
                                    setSearchQuery("");
                                    setHighlightedIndex(0);
                                }}
                                aria-label="Clear search"
                                className="text-muted-foreground hover:text-foreground absolute inset-y-0 right-0 flex cursor-pointer items-center pr-2.5 text-xs"
                            >
                                ✕
                            </button>
                        )}
                    </div>
                    <button
                        type="button"
                        disabled={
                            isMaxReached ||
                            !searchQuery.trim() ||
                            !availableChoices.some((c) => c.toLowerCase() === searchQuery.trim().toLowerCase())
                        }
                        onClick={() => handleAdd(searchQuery.trim())}
                        className="border-line bg-background text-12 text-muted-foreground hover:text-foreground hover:border-foreground font-body cursor-pointer rounded-[2px] border px-3 py-1.5 font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        + Add
                    </button>
                </div>

                {isOpen && !isMaxReached && (
                    <ul
                        id={listboxId}
                        role="listbox"
                        aria-label="Language suggestions"
                        className="border-line bg-background text-12 divide-line shadow-card absolute z-20 mt-1 max-h-56 w-full overflow-y-auto overscroll-contain rounded-[2px] border"
                    >
                        {filteredChoices.length === 0 ? (
                            <li className="text-12 text-muted-foreground font-body px-3 py-2.5 italic">
                                No languages match &ldquo;{searchQuery}&rdquo;.
                            </li>
                        ) : (
                            filteredChoices.map((choice, index) => (
                                <li
                                    key={choice}
                                    role="option"
                                    aria-selected={index === highlightedIndex}
                                    onClick={() => handleAdd(choice)}
                                    onMouseEnter={() => setHighlightedIndex(index)}
                                    className={`font-body flex cursor-pointer items-center justify-between px-3 py-2 transition-colors ${
                                        index === highlightedIndex
                                            ? "bg-faint text-foreground font-medium"
                                            : "text-foreground hover:bg-faint"
                                    }`}
                                >
                                    <span>{choice}</span>
                                </li>
                            ))
                        )}
                    </ul>
                )}
            </div>

            {isMaxReached && (
                <p className="text-11 text-muted-foreground font-body mt-2">
                    Maximum of {maxLanguages} languages reached.
                </p>
            )}
        </div>
    );
}
