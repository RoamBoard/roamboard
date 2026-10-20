"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { searchUsers } from "@/lib/profile";
import type { AuthUser } from "@/lib/auth";
import { limitCommentLength } from "@/lib/board-comments";
import { activeCommentMention, insertCommentMention } from "@/lib/comment-mentions";

export default function CommentMentionEditor({
    id,
    value,
    onChange,
    disabled,
    describedBy,
    placeholder,
    className,
    viewer
}: {
    id: string;
    value: string;
    onChange: (value: string) => void;
    disabled: boolean;
    describedBy: string;
    placeholder?: string;
    className: string;
    viewer?: AuthUser;
}) {
    const textarea = useRef<HTMLTextAreaElement>(null);
    const suggestionsList = useRef<HTMLUListElement>(null);
    const [cursor, setCursor] = useState(0);
    const [focused, setFocused] = useState(false);
    const [dismissed, setDismissed] = useState(false);
    const [result, setResult] = useState<{
        query: string;
        users: { userId: string; username: string; displayName: string }[];
    }>({ query: "", users: [] });
    const [selected, setSelected] = useState(0);
    const [failedQuery, setFailedQuery] = useState<string | null>(null);
    const [insertionError, setInsertionError] = useState(false);
    const active = focused && !dismissed ? activeCommentMention(value, cursor) : null;
    const query = active?.query ?? null;
    const suggestions = query !== null && result.query === query ? result.users : [];
    const showSuggestions = active !== null && suggestions.length > 0;

    useEffect(() => {
        if (!showSuggestions) return;
        suggestionsList.current?.children.item(selected)?.scrollIntoView({ block: "nearest" });
    }, [showSuggestions, selected, result]);

    useEffect(() => {
        if (query === null || disabled) return;
        const request = { current: true };
        const timer = window.setTimeout(() => {
            void searchUsers(query, 50)
                .then((users) => {
                    if (!request.current) return;
                    const matching = users
                        .filter((user) => user.username.toLowerCase().startsWith(query.toLowerCase()))
                        .map(({ userId, username, displayName }) => ({ userId, username, displayName }));
                    if (viewer?.username.toLowerCase().startsWith(query.toLowerCase()))
                        matching.unshift({
                            userId: viewer.userId,
                            username: viewer.username,
                            displayName: viewer.displayName
                        });
                    setResult({ query, users: matching });
                    setSelected(0);
                    setFailedQuery(null);
                })
                .catch(() => {
                    if (request.current) {
                        setResult({ query, users: [] });
                        setFailedQuery(query);
                    }
                });
        }, 200);
        return () => {
            request.current = false;
            window.clearTimeout(timer);
        };
    }, [query, disabled, viewer]);

    function choose(username: string) {
        if (!active) return;
        const inserted = insertCommentMention(value, active, username);
        if (!inserted) {
            setInsertionError(true);
            return;
        }
        onChange(inserted.value);
        setInsertionError(false);
        setDismissed(true);
        setResult({ query: "", users: [] });
        window.requestAnimationFrame(() => {
            textarea.current?.focus();
            textarea.current?.setSelectionRange(inserted.cursor, inserted.cursor);
        });
    }

    function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
        if (!active || suggestions.length === 0) return;
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setSelected(
                (current) => (current + (event.key === "ArrowDown" ? 1 : -1) + suggestions.length) % suggestions.length
            );
        } else if (event.key === "Enter") {
            event.preventDefault();
            choose(suggestions[selected % suggestions.length]!.username);
        } else if (event.key === "Escape") {
            event.preventDefault();
            setDismissed(true);
        }
    }

    return (
        <div className="relative">
            <textarea
                ref={textarea}
                id={id}
                value={value}
                onChange={(event) => {
                    onChange(limitCommentLength(event.target.value));
                    setCursor(event.target.selectionStart);
                    setDismissed(false);
                    setInsertionError(false);
                }}
                onClick={(event) => {
                    setCursor(event.currentTarget.selectionStart);
                    setDismissed(false);
                    setInsertionError(false);
                }}
                onKeyUp={(event) => setCursor(event.currentTarget.selectionStart)}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                onKeyDown={onKeyDown}
                placeholder={placeholder}
                role="combobox"
                aria-describedby={`${describedBy}${insertionError ? ` ${id}-mention-error` : ""}`}
                aria-autocomplete="list"
                aria-expanded={showSuggestions}
                aria-haspopup="listbox"
                aria-controls={`${id}-mentions`}
                aria-activedescendant={showSuggestions ? `${id}-mention-${selected}` : undefined}
                className={className}
                disabled={disabled}
            />
            {showSuggestions ? (
                <ul
                    ref={suggestionsList}
                    id={`${id}-mentions`}
                    role="listbox"
                    aria-label="Mention a traveler"
                    className="border-line bg-background absolute right-0 bottom-full left-0 z-20 mb-1 max-h-48 overflow-auto border shadow-lg"
                >
                    {suggestions.map((user, index) => (
                        <li
                            id={`${id}-mention-${index}`}
                            key={user.userId}
                            role="option"
                            aria-selected={index === selected}
                        >
                            <button
                                type="button"
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={() => choose(user.username)}
                                className={`text-13 w-full cursor-pointer px-3 py-2 text-left ${index === selected ? "bg-faint" : "hover:bg-faint"}`}
                            >
                                {user.displayName} <span className="text-muted-foreground">@{user.username}</span>
                            </button>
                        </li>
                    ))}
                </ul>
            ) : active && failedQuery === query ? (
                <p role="alert" className="text-muted-foreground text-12 mt-1">
                    Could not load username suggestions. You can still type the exact handle.
                </p>
            ) : null}
            {insertionError ? (
                <p id={`${id}-mention-error`} role="alert" className="text-12 mt-1">
                    This @handle does not fit. Shorten the comment before adding it.
                </p>
            ) : null}
        </div>
    );
}
