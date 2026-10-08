"use client";

type VibeDefinition = {
    id: string;
    label: string;
    icon: React.ReactNode;
};

export const AVAILABLE_VIBES: VibeDefinition[] = [
    {
        id: "Adventure",
        label: "Adventure",
        icon: (
            <svg
                className="size-3.5 shrink-0"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
            >
                <path d="m8 3 4 8 5-5 5 15H2L8 3z" />
            </svg>
        )
    },
    {
        id: "Relax",
        label: "Relax",
        icon: (
            <svg
                className="size-3.5 shrink-0"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
            >
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2" />
                <path d="M12 20v2" />
                <path d="m4.93 4.93 1.41 1.41" />
                <path d="m17.66 17.66 1.41 1.41" />
                <path d="M2 12h2" />
                <path d="M20 12h2" />
                <path d="m6.34 17.66-1.41 1.41" />
                <path d="m19.07 4.93-1.41 1.41" />
            </svg>
        )
    },
    {
        id: "Culture",
        label: "Culture",
        icon: (
            <svg
                className="size-3.5 shrink-0"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
            >
                <path d="M3 21h18" />
                <path d="M5 21V10" />
                <path d="M19 21V10" />
                <path d="M10 21V10" />
                <path d="M14 21V10" />
                <path d="M2 10h20" />
                <path d="m12 3 10 7H2l10-7z" />
            </svg>
        )
    },
    {
        id: "Foodie",
        label: "Foodie",
        icon: (
            <svg
                className="size-3.5 shrink-0"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
            >
                <path d="M18 12c0 3.3-2.7 6-6 6s-6-2.7-6-6h12z" />
                <path d="M9 4v3" />
                <path d="M12 3v4" />
                <path d="M15 4v3" />
                <path d="M4 12h16" />
            </svg>
        )
    },
    {
        id: "Nature",
        label: "Nature",
        icon: (
            <svg
                className="size-3.5 shrink-0"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
            >
                <path d="M12 2 7 9h3l-4 7h6v4h2v-4h6l-4-7h3l-5-7z" />
            </svg>
        )
    },
    {
        id: "Romantic",
        label: "Romantic",
        icon: (
            <svg
                className="size-3.5 shrink-0"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
            >
                <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
            </svg>
        )
    },
    {
        id: "Budget",
        label: "Budget",
        icon: (
            <svg
                className="size-3.5 shrink-0"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
            >
                <rect width="20" height="14" x="2" y="5" rx="2" />
                <line x1="2" x2="22" y1="10" y2="10" />
                <circle cx="16" cy="14" r="1.5" />
            </svg>
        )
    },
    {
        id: "Hidden Gems",
        label: "Hidden Gems",
        icon: (
            <svg
                className="size-3.5 shrink-0"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
            >
                <path d="M6 3h12l4 6-10 12L2 9z" />
                <path d="M2 9h20" />
                <path d="m6 3 4 6 2 12 2-12 4-6" />
            </svg>
        )
    },
    {
        id: "City",
        label: "City",
        icon: (
            <svg
                className="size-3.5 shrink-0"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
            >
                <rect width="8" height="16" x="3" y="6" rx="1" />
                <rect width="8" height="20" x="13" y="2" rx="1" />
                <path d="M7 10h.01" />
                <path d="M7 14h.01" />
                <path d="M17 6h.01" />
                <path d="M17 10h.01" />
                <path d="M17 14h.01" />
            </svg>
        )
    }
];

type Props = {
    selectedVibes: string[];
    onChange: (vibes: string[]) => void;
    maxVibes?: number;
    className?: string;
};

export default function VibeSelector({
    selectedVibes,
    onChange,
    maxVibes = 5,
    className = ""
}: Props) {
    function toggleVibe(vibeId: string) {
        if (selectedVibes.includes(vibeId)) {
            onChange(selectedVibes.filter((id) => id !== vibeId));
        } else {
            if (selectedVibes.length < maxVibes) {
                onChange([...selectedVibes, vibeId]);
            }
        }
    }

    return (
        <div className={`space-y-2 ${className}`}>
            <div className="flex items-center gap-1.5">
                <label
                    id="vibe-group-label"
                    className="text-11 tracking-label text-graphite font-bold uppercase"
                >
                    Vibe
                </label>
                <span
                    className="text-stone hover:text-graphite inline-flex cursor-help items-center"
                    title={`Select up to ${maxVibes} vibes that describe this trip`}
                    aria-label="Vibe information"
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
                    (up to {maxVibes})
                </span>
                <span className="text-10 text-stone ml-auto">
                    {selectedVibes.length}/{maxVibes}
                </span>
            </div>

            {/* Hidden inputs for form submission */}
            {selectedVibes.map((v) => (
                <input key={v} type="hidden" name="vibes" value={v} />
            ))}

            <div
                role="group"
                aria-labelledby="vibe-group-label"
                className="flex flex-wrap gap-2"
            >
                {AVAILABLE_VIBES.map((vibe) => {
                    const isSelected = selectedVibes.includes(vibe.id);
                    const isLimitReached =
                        !isSelected && selectedVibes.length >= maxVibes;

                    return (
                        <button
                            key={vibe.id}
                            type="button"
                            role="checkbox"
                            aria-checked={isSelected}
                            disabled={isLimitReached}
                            onClick={() => toggleVibe(vibe.id)}
                            className={`flex cursor-pointer items-center gap-1.5 rounded-[2px] border px-2.5 py-1 text-12 font-medium transition-all focus-visible:outline-1 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-40 ${
                                isSelected
                                    ? "border-obsidian bg-porcelain/60 text-obsidian shadow-xs"
                                    : "border-line bg-background text-graphite hover:border-slate/60 hover:text-obsidian"
                            }`}
                        >
                            {vibe.icon}
                            <span>{vibe.label}</span>
                            {isSelected && (
                                <span
                                    className="text-stone hover:text-obsidian ml-0.5 text-xs leading-none"
                                    aria-hidden="true"
                                >
                                    ×
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

