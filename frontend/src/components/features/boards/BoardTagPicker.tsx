"use client";

import { useRef, useState } from "react";
import { X } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { Command, CommandInput, CommandList, CommandEmpty, CommandItem } from "@/components/ui/command";
import TagIcon from "@/components/ui/TagIcon";
import { boardTags } from "@/data/board-tags";
import CreatorDetailIcon from "@/components/features/boards/CreatorDetailIcon";

type Props = {
    values: string[];
    suggestions: string[];
    disabled?: boolean;
    loading?: boolean;
    error?: string;
    onRetry?: () => void;
    onChange: (values: string[]) => void;
};

export default function BoardTagPicker({
    values,
    suggestions,
    disabled = false,
    loading = false,
    error = "",
    onRetry,
    onChange
}: Props) {
    const [query, setQuery] = useState("");
    const [open, setOpen] = useState(false);
    const selectedRef = useRef<HTMLUListElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const reducedMotion = useReducedMotion();
    const atLimit = values.length >= 3;
    const unavailable = disabled || loading || Boolean(error) || atLimit;
    const choices = [...new Set(suggestions)].filter(
        (name) => !values.some((value) => value.toLowerCase() === name.toLowerCase())
    );
    function select(name: string) {
        if (!open || unavailable || !choices.includes(name)) return;
        onChange([...values, name]);
        setQuery("");
        if (values.length === 2) {
            setOpen(false);
            requestAnimationFrame(() =>
                selectedRef.current?.querySelector<HTMLButtonElement>("li:last-child button")?.focus()
            );
        }
    }
    function remove(name: string) {
        if (disabled) return;
        onChange(values.filter((item) => item !== name));
        if (!loading && !error) requestAnimationFrame(() => inputRef.current?.focus());
    }
    return (
        <div
            id="board-tags"
            tabIndex={-1}
            className="max-w-3xl min-w-0 scroll-mt-36 focus-visible:outline-1 focus-visible:outline-offset-4"
        >
            <div className="flex flex-wrap items-center gap-3">
                <h3 className="text-foreground/80 text-20 font-bold">Tags</h3>
                <span className="text-muted-foreground inline-flex items-center gap-2 text-[11px]">
                    <CreatorDetailIcon name="information" /> Up to 3
                </span>
                <span
                    className="text-muted-foreground ml-auto text-xs tabular-nums"
                    aria-label={`${values.length} of 3 tags selected`}
                >
                    {values.length} / 3
                </span>
            </div>
            <p id="board-tags-help" className="text-muted-foreground mt-3 text-xs leading-relaxed">
                Choose a few ways for others to discover your Board.
            </p>
            <ul ref={selectedRef} aria-label="Selected Board tags" className="mt-5 flex flex-wrap gap-x-6 gap-y-3">
                {values.map((value) => {
                    const catalogTag = boardTags.find((tag) => tag.name.toLowerCase() === value.toLowerCase());
                    return (
                        <motion.li
                            key={value}
                            layout={reducedMotion ? false : "position"}
                            initial={false}
                            transition={{ duration: reducedMotion ? 0 : 0.16 }}
                            className="border-line text-foreground/80 inline-flex min-h-11 max-w-full items-center gap-3 border-l pl-3 text-xs"
                        >
                            {catalogTag ? (
                                <TagIcon tag={catalogTag} size={20} className="text-muted-foreground shrink-0" />
                            ) : null}
                            <span className="break-words">{value}</span>
                            <button
                                type="button"
                                disabled={disabled}
                                aria-label={`Remove ${value}`}
                                onClick={() => remove(value)}
                                className="text-muted-foreground hover:text-foreground grid size-11 shrink-0 place-items-center focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-40"
                            >
                                <X size={12} aria-hidden="true" strokeWidth={1} />
                            </button>
                        </motion.li>
                    );
                })}
            </ul>
            <Command
                label="Tags"
                className="mt-4"
                onFocusCapture={() => {
                    if (!unavailable) setOpen(true);
                }}
                onBlurCapture={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
                }}
                onKeyDown={(event) => {
                    if (event.key === "Escape") {
                        event.preventDefault();
                        setOpen(false);
                    }
                    if (event.key === "Enter" && !open) {
                        event.preventDefault();
                        if (!unavailable) setOpen(true);
                    }
                    if (!unavailable && ["ArrowDown", "ArrowUp"].includes(event.key)) setOpen(true);
                }}
            >
                <CommandInput
                    ref={inputRef}
                    value={query}
                    onValueChange={(value) => {
                        setQuery(value);
                        setOpen(true);
                    }}
                    disabled={unavailable}
                    aria-label="Tags"
                    aria-describedby="board-tags-help board-tags-state"
                    aria-expanded={open && !unavailable}
                    placeholder={
                        loading
                            ? "Loading tags…"
                            : atLimit
                              ? "Three tags selected"
                              : error
                                ? "Tags unavailable"
                                : "Search tags to add"
                    }
                    className="text-sm"
                />
                <CommandList
                    hidden={!open || unavailable}
                    aria-label="Available Board tags"
                    className="border-line border-b"
                >
                    <CommandEmpty>No matching tags. Try another search.</CommandEmpty>
                    {choices.map((name) => (
                        <CommandItem key={name} value={name} onSelect={() => select(name)}>
                            {name}
                        </CommandItem>
                    ))}
                </CommandList>
            </Command>
            <div id="board-tags-state" className="text-muted-foreground mt-3 text-[11px] leading-relaxed">
                {loading ? (
                    <p role="status">Loading the Board tag catalog…</p>
                ) : error ? (
                    <div role="alert">
                        <p className="break-words">{error}</p>
                        {onRetry ? (
                            <button
                                type="button"
                                disabled={disabled}
                                onClick={onRetry}
                                className="hover:text-foreground mt-1 min-h-11 underline underline-offset-4 focus-visible:outline-2"
                            >
                                Retry tags
                            </button>
                        ) : null}
                    </div>
                ) : atLimit ? (
                    <p role="status">Three tags selected. Remove one to choose another.</p>
                ) : suggestions.length === 0 ? (
                    <p>No tags are available right now.</p>
                ) : (
                    <p>Choose from the Board tag catalog. Typing searches; it never creates a new tag.</p>
                )}
            </div>
        </div>
    );
}
