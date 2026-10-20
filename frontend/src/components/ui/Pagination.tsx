import Link from "next/link";

export default function Pagination({
    page,
    totalPages,
    href
}: {
    page: number;
    totalPages: number;
    href: (page: number) => string;
}) {
    if (totalPages < 2) return null;
    const pages = [...new Set([1, ...Array.from({ length: 5 }, (_, index) => page + index - 2), totalPages])]
        .filter((value) => value >= 1 && value <= totalPages)
        .sort((a, b) => a - b);
    return (
        <nav aria-label="Search results pages" className="mt-12 flex flex-wrap items-center justify-center gap-2">
            {page > 1 && (
                <Link href={href(page - 1)} className="min-h-11 px-3 py-3 underline">
                    Previous
                </Link>
            )}
            {pages.map((value, index) => (
                <span key={value} className="inline-flex items-center">
                    {index > 0 && value - pages[index - 1] > 1 && (
                        <span className="px-2" aria-hidden="true">
                            …
                        </span>
                    )}
                    <Link
                        href={href(value)}
                        aria-current={value === page ? "page" : undefined}
                        aria-label={`Page ${value}`}
                        className={`min-h-11 min-w-11 px-3 py-3 text-center ${value === page ? "border-foreground border-b font-bold" : "hover:bg-faint"}`}
                    >
                        {value}
                    </Link>
                </span>
            ))}
            {page < totalPages && (
                <Link href={href(page + 1)} className="min-h-11 px-3 py-3 underline">
                    Next
                </Link>
            )}
        </nav>
    );
}
