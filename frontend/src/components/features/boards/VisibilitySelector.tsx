"use client";

import type { BoardVisibility } from "@/types/board";

type VisibilityOption = {
    value: BoardVisibility | "collaborators";
    label: string;
    description: string;
    icon: (isActive: boolean) => React.ReactNode;
};

const VISIBILITY_OPTIONS: VisibilityOption[] = [
    {
        value: "collaborators",
        label: "Private",
        description: "You and invited Board members can see this",
        icon: (isActive: boolean) => (
            <svg
                className={`size-4 shrink-0 transition-colors ${
                    isActive ? "text-foreground" : "text-muted-foreground"
                }`}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
            >
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
        )
    },
    {
        value: "friends",
        label: "Friends",
        description: "Visible to you and your friends",
        icon: (isActive: boolean) => (
            <svg
                className={`size-4 shrink-0 transition-colors ${
                    isActive ? "text-foreground" : "text-muted-foreground"
                }`}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
            >
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
        )
    },
    {
        value: "public",
        label: "Public",
        description: "Discoverable by everyone",
        icon: (isActive: boolean) => (
            <svg
                className={`size-4 shrink-0 transition-colors ${
                    isActive ? "text-foreground" : "text-muted-foreground"
                }`}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
            >
                <circle cx="12" cy="12" r="10" />
                <line x1="2" y1="12" x2="22" y2="12" />
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
        )
    }
];

type Props = {
    value: BoardVisibility | "collaborators";
    onChange: (value: BoardVisibility | "collaborators") => void;
    name?: string;
    showLabel?: boolean;
    className?: string;
};

export default function VisibilitySelector({
    value,
    onChange,
    name = "visibility",
    showLabel = true,
    className = ""
}: Props) {
    return (
        <div className={`space-y-2 ${className}`}>
            {showLabel && (
                <div className="flex items-center gap-1.5">
                    <label
                        id="visibility-group-label"
                        className="text-11 tracking-label text-muted-foreground font-bold uppercase"
                    >
                        Visibility
                    </label>
                    <span
                        className="text-muted-foreground hover:text-foreground inline-flex cursor-help items-center"
                        title="Choose who can see and discover this board"
                        aria-label="Visibility information"
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
                </div>
            )}

            {/* Hidden input for HTML form submission */}
            <input type="hidden" name={name} value={value} />

            <div
                role="radiogroup"
                aria-labelledby={showLabel ? "visibility-group-label" : undefined}
                className="grid grid-cols-1 gap-2.5 sm:grid-cols-3"
            >
                {VISIBILITY_OPTIONS.map((option) => {
                    const isSelected = value === option.value;
                    return (
                        <button
                            key={option.value}
                            type="button"
                            role="radio"
                            aria-checked={isSelected}
                            onClick={() => onChange(option.value)}
                            className={`group relative flex cursor-pointer items-start gap-3 rounded-[2px] border p-3 text-left transition-all focus-visible:outline-1 focus-visible:outline-offset-2 ${
                                isSelected
                                    ? "border-foreground bg-faint/50 shadow-xs"
                                    : "border-line bg-background hover:border-line hover:bg-faint/20"
                            }`}
                        >
                            <div className="mt-0.5">{option.icon(isSelected)}</div>
                            <div className="flex-1">
                                <div
                                    className={`text-12 font-bold tracking-tight ${
                                        isSelected
                                            ? "text-foreground"
                                            : "text-muted-foreground group-hover:text-foreground"
                                    }`}
                                >
                                    {option.label}
                                </div>
                                <p className="text-10 text-muted-foreground mt-0.5 leading-snug">
                                    {option.description}
                                </p>
                            </div>

                            {/* Active bottom line indicator as shown in designer spec */}
                            {isSelected && (
                                <span
                                    aria-hidden="true"
                                    className="bg-foreground absolute bottom-0 left-0 h-[2px] w-full"
                                />
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
