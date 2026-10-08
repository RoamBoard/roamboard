"use client";

import { useState } from "react";

type Props = {
    collaborators: string[];
    onChange: (collaborators: string[]) => void;
    className?: string;
};

export default function CollaboratorInput({
    collaborators,
    onChange,
    className = ""
}: Props) {
    const [inputValue, setInputValue] = useState("");

    function handleAdd() {
        const trimmed = inputValue.trim();
        if (trimmed && !collaborators.includes(trimmed)) {
            onChange([...collaborators, trimmed]);
            setInputValue("");
        }
    }

    function handleRemove(index: number) {
        onChange(collaborators.filter((_, i) => i !== index));
    }

    function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
        if (e.key === "Enter") {
            e.preventDefault();
            handleAdd();
        }
    }

    return (
        <div className={`space-y-2 ${className}`}>
            <div className="flex items-center gap-1.5">
                <label
                    htmlFor="collaborators-input"
                    className="text-11 tracking-label text-graphite font-bold uppercase"
                >
                    Collaborators
                </label>
                <span
                    className="text-stone hover:text-graphite inline-flex cursor-help items-center"
                    title="Invite friends to view or co-edit this board"
                    aria-label="Collaborators information"
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
                <span className="text-10 text-stone font-medium">
                    (optional)
                </span>
            </div>

            {/* Hidden inputs for form data submission */}
            {collaborators.map((c, idx) => (
                <input key={idx} type="hidden" name="collaborators" value={c} />
            ))}

            {/* Input field with User outline icon as in designer mockup */}
            <div className="border-line bg-background focus-within:border-obsidian relative flex items-center rounded-[2px] border transition-colors">
                <span className="text-stone pointer-events-none pl-3" aria-hidden="true">
                    <svg
                        className="size-4"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.75"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                    </svg>
                </span>
                <input
                    id="collaborators-input"
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="invite by username or email"
                    className="text-13 text-obsidian placeholder:text-stone font-body flex-1 bg-transparent px-3 py-2 focus-visible:outline-none"
                />
                {inputValue.trim() && (
                    <button
                        type="button"
                        onClick={handleAdd}
                        className="text-11 text-obsidian hover:bg-porcelain mr-2 cursor-pointer rounded-[2px] px-2.5 py-1 font-medium transition-colors"
                    >
                        Invite +
                    </button>
                )}
            </div>

            {/* Invited collaborators chip list */}
            {collaborators.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                    {collaborators.map((c, idx) => (
                        <span
                            key={idx}
                            className="border-line bg-porcelain/40 text-11 text-obsidian flex items-center gap-1.5 rounded-[2px] border px-2.5 py-1 font-medium"
                        >
                            <span className="bg-graphite text-background flex size-4 items-center justify-center rounded-full text-[9px] font-bold uppercase">
                                {c.charAt(0)}
                            </span>
                            <span>{c}</span>
                            <button
                                type="button"
                                onClick={() => handleRemove(idx)}
                                aria-label={`Remove collaborator ${c}`}
                                className="text-stone hover:text-obsidian cursor-pointer text-xs font-bold leading-none"
                            >
                                ×
                            </button>
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
}

