"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

type Props = {
    languages: string[];
    onChangeLanguages: (languages: string[]) => void;
    choices: string[];
    maxLanguages?: number;
};

export function rankLanguageChoices(choices: string[], query: string, selectedLanguages: string[] = []): string[] {
    const selectedSet = new Set(selectedLanguages.map((l) => l.toLowerCase()));
    const available = choices.filter((choice) => !selectedSet.has(choice.toLowerCase()));
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return available;

    const matches = available.filter((choice) => choice.toLowerCase().includes(normalizedQuery));

    return matches.sort((a, b) => {
        const lowerA = a.toLowerCase();
        const lowerB = b.toLowerCase();

        const aStarts = lowerA.startsWith(normalizedQuery);
        const bStarts = lowerB.startsWith(normalizedQuery);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;

        const aWordStarts = lowerA.split(/\s+/).some((word) => word.startsWith(normalizedQuery));
        const bWordStarts = lowerB.split(/\s+/).some((word) => word.startsWith(normalizedQuery));
        if (aWordStarts && !bWordStarts) return -1;
        if (!aWordStarts && bWordStarts) return 1;

        const indexA = lowerA.indexOf(normalizedQuery);
        const indexB = lowerB.indexOf(normalizedQuery);
        if (indexA !== indexB) {
            return indexA - indexB;
        }

        return lowerA.localeCompare(lowerB);
    });
}

export default function LanguageEditor({ languages, onChangeLanguages, choices, maxLanguages = 10 }: Props) {
    const [searchQuery, setSearchQuery] = useState("");
    const [isOpen, setIsOpen] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState(0);
    const listboxId = useId();
    const containerRef = useRef<HTMLDivElement>(null);
    const listboxRef = useRef<HTMLUListElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const isMaxReached = languages.length >= maxLanguages;

    const availableChoices = useMemo(() => {
        const selectedSet = new Set(languages.map((l) => l.toLowerCase()));
        return choices.filter((choice) => !selectedSet.has(choice.toLowerCase()));
    }, [choices, languages]);

    const filteredChoices = useMemo(() => {
        return rankLanguageChoices(choices, searchQuery, languages);
    }, [choices, searchQuery, languages]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    useEffect(() => {
        if (!isOpen || !listboxRef.current) return;
        const activeOption = listboxRef.current.querySelector<HTMLElement>(`[data-index="${highlightedIndex}"]`);
        activeOption?.scrollIntoView({ block: "nearest" });
    }, [highlightedIndex, isOpen]);

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
            inputRef.current?.focus();
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
                setHighlightedIndex(0);
            } else if (filteredChoices.length > 0) {
                setHighlightedIndex((prev) => (prev + 1) % filteredChoices.length);
            }
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            if (!isOpen) {
                setIsOpen(true);
                setHighlightedIndex(Math.max(0, filteredChoices.length - 1));
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
                const exactMatch = availableChoices.find((c) => c.toLowerCase() === searchQuery.trim().toLowerCase());
                if (exactMatch) {
                    handleAdd(exactMatch);
                } else if (filteredChoices.length > 0) {
                    handleAdd(filteredChoices[0]);
                }
            }
        } else if (e.key === "Escape") {
            e.preventDefault();
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
            <p className="text-12 text-muted-foreground font-body mt-0.5">
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

            <div ref={containerRef} className="relative mt-4 max-w-sm">
                <div className="relative">
                    <input
                        ref={inputRef}
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
                        onClick={() => {
                            if (!isMaxReached) setIsOpen(true);
                        }}
                        onChange={(e) => {
                            setSearchQuery(e.target.value);
                            setIsOpen(true);
                            setHighlightedIndex(0);
                        }}
                        onKeyDown={handleKeyDown}
                        placeholder={isMaxReached ? `Limit reached (${maxLanguages} max)` : "Search language to add…"}
                        className="border-line bg-background text-12 text-foreground placeholder:text-muted-foreground font-body focus:border-foreground w-full rounded-[2px] border px-3 py-1.5 pr-12 transition-colors focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                    />
                    <div className="absolute inset-y-0 right-0 flex items-center gap-1 pr-2">
                        {searchQuery && (
                            <button
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => {
                                    setSearchQuery("");
                                    setHighlightedIndex(0);
                                    inputRef.current?.focus();
                                }}
                                aria-label="Clear search"
                                className="text-muted-foreground hover:text-foreground cursor-pointer text-xs"
                            >
                                ✕
                            </button>
                        )}
                        <button
                            type="button"
                            disabled={isMaxReached}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                                if (isMaxReached) return;
                                setIsOpen((prev) => !prev);
                                inputRef.current?.focus();
                            }}
                            aria-label={isOpen ? "Close suggestions" : "Open suggestions"}
                            className="text-muted-foreground hover:text-foreground text-10 cursor-pointer disabled:cursor-not-allowed"
                        >
                            {isOpen ? "▲" : "▼"}
                        </button>
                    </div>
                </div>

                {isOpen && !isMaxReached && (
                    <ul
                        ref={listboxRef}
                        id={listboxId}
                        role="listbox"
                        aria-label="Language suggestions"
                        onMouseDown={(e) => e.preventDefault()}
                        className="border-line bg-background text-12 shadow-card absolute z-20 mt-1 max-h-56 w-full overflow-y-auto overscroll-contain rounded-[2px] border"
                    >
                        {filteredChoices.length === 0 ? (
                            <li className="text-12 text-muted-foreground font-body px-3 py-2.5 italic">
                                No languages match &ldquo;{searchQuery}&rdquo;.
                            </li>
                        ) : (
                            filteredChoices.map((choice, index) => (
                                <li
                                    key={choice}
                                    data-index={index}
                                    role="option"
                                    aria-selected={index === highlightedIndex}
                                    onMouseDown={(e) => {
                                        e.preventDefault();
                                    }}
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
