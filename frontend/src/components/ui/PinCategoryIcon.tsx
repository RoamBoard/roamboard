import type { PinCategory } from "@/types/board-creator";

type Props = { category: PinCategory; className?: string };

const paths: Record<PinCategory, React.ReactNode> = {
    landmark: (
        <>
            <path d="M12 3 4 8h16l-8-5Z" />
            <path d="M6 10v7m4-7v7m4-7v7m4-7v7M4 20h16" />
        </>
    ),
    culture: (
        <>
            <path d="M4 19h16M6 16l2-9 4 3 4-3 2 9" />
            <path d="M9 16h6" />
        </>
    ),
    museum: (
        <>
            <path d="M3 9h18L12 4 3 9Zm2 11h14M6 11v6m4-6v6m4-6v6m4-6v6" />
        </>
    ),
    restaurant: (
        <>
            <path d="M7 3v8m-3-8v5a3 3 0 0 0 6 0V3M7 11v10M17 3v18m0-18c-3 3-3 8 0 9" />
        </>
    ),
    cafe: (
        <>
            <path d="M5 8h11v6a5 5 0 0 1-5 5H10a5 5 0 0 1-5-5V8Z" />
            <path d="M16 10h2a2 2 0 0 1 0 4h-2M8 3v2m4-2v2" />
        </>
    ),
    bar: (
        <>
            <path d="M5 4h14l-6 7v8h4v2H7v-2h4v-8L5 4Z" />
        </>
    ),
    shopping: (
        <>
            <path d="M5 8h14l-1 13H6L5 8Z" />
            <path d="M9 9V6a3 3 0 0 1 6 0v3" />
        </>
    ),
    park: (
        <>
            <path d="m12 3-5 7h3l-4 6h5v5h2v-5h5l-4-6h3l-5-7Z" />
        </>
    ),
    nature: (
        <>
            <path d="M19 4C9 5 5 10 5 16c5 0 11-4 14-12Z" />
            <path d="M5 20c2-6 6-9 11-12" />
        </>
    ),
    hike: (
        <>
            <circle cx="13" cy="4" r="2" />
            <path d="m11 8-3 5 4 2 2 6m-3-8 4-2 3 3M8 13l-4 7" />
        </>
    ),
    beach: (
        <>
            <path d="M4 17c4-4 12-4 16 0M12 17v4M7 6c3-4 7-4 10 0-3 0-4 2-5 5-1-3-2-5-5-5Z" />
        </>
    ),
    neighborhood: (
        <>
            <path d="M4 20V9l5-4 5 4v11M14 12l3-2 3 2v8M8 13h2m-2 3h2" />
        </>
    ),
    city: (
        <>
            <path d="M4 21V8h6v13m0-17h6v17m0-10h4v10M7 11h1m-1 3h1m5-7h1m-1 3h1m-1 3h1" />
        </>
    ),
    address: (
        <>
            <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
            <circle cx="12" cy="10" r="2" />
        </>
    ),
    stay: (
        <>
            <path d="M3 19v-8h18v8M5 11V7h6v4m0 0V6h7a3 3 0 0 1 3 3v2M3 16h18" />
        </>
    ),
    transit: (
        <>
            <rect x="5" y="3" width="14" height="16" rx="2" />
            <path d="M8 7h8M8 14h8m-8 5-2 2m10-2 2 2" />
        </>
    ),
    event: (
        <>
            <rect x="4" y="5" width="16" height="15" rx="1" />
            <path d="M8 3v4m8-4v4M4 10h16" />
        </>
    ),
    activity: (
        <>
            <circle cx="12" cy="12" r="9" />
            <path d="m10 8 6 4-6 4V8Z" />
        </>
    ),
    other: (
        <>
            <circle cx="12" cy="12" r="9" />
            <path d="M8 12h8M12 8v8" />
        </>
    )
};

export default function PinCategoryIcon({
    category,
    className = "size-5"
}: Props) {
    return (
        <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
        >
            {paths[category]}
        </svg>
    );
}
