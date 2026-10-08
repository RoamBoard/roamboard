"use client";

import { useState, useRef, useEffect } from "react";

type Props = {
    label: string;
    tags: string[];
    onChange: (tags: string[]) => void;
    addButtonLabel?: string;
    placeholder?: string;
    name?: string;
    optional?: boolean;
    tooltip?: string;
    formatTag?: (tag: string) => string;
    className?: string;
};

export default function PillTagInput({
    label,
    tags,
    onChange,
    addButtonLabel = "add tag +",
    placeholder = "Type and press enter...",
    name = "tags",
    optional = true,
    tooltip,
    formatTag = (t) => t.trim(),
    className = ""
}: Props) {
    const [isAdding, setIsAdding] = useState(false);
    const [inputValue, setInputValue] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isAdding) {
            inputRef.current?.focus();
        }
    }, [isAdding]);

    function handleRemove(index: number) {
        onChange(tags.filter((_, i) => i !== index));
    }

    function handleCommit() {
        const formatted = formatTag(inputValue);
        if (formatted && !tags.includes(formatted)) {
            onChange([...tags, formatted]);
        }
        setInputValue("");
        setIsAdding(false);
    }

    function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
        if (e.key === "Enter") {
            e.preventDefault();
            handleCommit();
        } else if (e.key === "Escape") {
            setIsAdding(false);
            setInputValue("");
        }
    }

    return (
        <div className={`space-y-2 ${className}`}>
            <div className="flex items-center gap-1.5">
                <label
                    id={`${name}-group-label`}
                    className="text-11 tracking-label text-graphite font-bold uppercase"
                >
                    {label}
                </label>
                <span
                    className="text-stone hover:text-graphite inline-flex cursor-help items-center"
                    title={tooltip ?? `Manage ${label.toLowerCase()} for this board`}
                    aria-label={`${label} information`}
                >
                    <svg
                        className="size-3"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="16" x2="12" y2="12" />
                        <line x1="12" y1="8" x2="12.01" y2="8" />
                    </svg>
                </span>
                {optional && (
                    <span className="text-10 text-stone font-medium">
                        (optional)
                    </span>
                )}
            </div>

            {/* Hidden inputs for form data submission */}
            {tags.map((t, idx) => (
                <input key={idx} type="hidden" name={name} value={t} />
            ))}

            <div
                role="group"
                aria-labelledby={`${name}-group-label`}
                className="flex flex-wrap items-center gap-2"
            >
                {tags.map((tag, idx) => (
                    <span
                        key={`${tag}-${idx}`}
                        className="border-line bg-background text-12 text-obsidian flex items-center gap-1.5 rounded-[2px] border px-2.5 py-1 font-medium shadow-2xs transition-colors hover:border-slate/60 hover:bg-porcelain/40"
                    >
                        <span>{tag}</span>
                        <button
                            type="button"
                            onClick={() => handleRemove(idx)}
                            aria-label={`Remove ${tag}`}
                            className="text-stone hover:text-obsidian cursor-pointer text-xs font-bold leading-none transition-colors"
                        >
                            ×
                        </button>
                    </span>
                ))}

                {isAdding ? (
                    <div className="flex items-center gap-1">
                        <input
                            ref={inputRef}
                            type="text"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyDown={handleKeyDown}
                            onBlur={() => {
                                if (inputValue.trim()) {
                                    handleCommit();
                                } else {
                                    setIsAdding(false);
                                }
                            }}
                            placeholder={placeholder}
                            className="border-line bg-background text-12 text-obsidian placeholder:text-stone focus:border-obsidian rounded-[2px] border px-2.5 py-1 transition-colors focus-visible:outline-none"
                        />
                        <button
                            type="button"
                            onClick={handleCommit}
                            className="border-line text-11 text-obsidian hover:bg-porcelain cursor-pointer rounded-[2px] border px-2 py-1 font-medium transition-colors"
                        >
                            ✓
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setIsAdding(false);
                                setInputValue("");
                            }}
                            className="text-11 text-stone hover:text-obsidian cursor-pointer px-1 py-1 font-medium transition-colors"
                        >
                            ✕
                        </button>
                    </div>
                ) : (
                    <button
                        type="button"
                        onClick={() => setIsAdding(true)}
                        className="border-line text-12 text-graphite hover:text-obsidian hover:border-obsidian cursor-pointer rounded-[2px] border border-dashed px-2.5 py-1 font-medium transition-colors"
                    >
                        {addButtonLabel}
                    </button>
                )}
            </div>
        </div>
    );
}

