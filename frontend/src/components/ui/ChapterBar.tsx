"use client";
export default function ChapterBar({
    chapters,
    current,
    onNavigate
}: {
    chapters: { id: string; title: string }[];
    current: string;
    onNavigate: (id: string) => void;
}) {
    return (
        <nav
            aria-label="Story chapters"
            className="border-line bg-background/95 sticky top-0 z-30 flex h-[62px] max-w-full items-center gap-1 overflow-x-auto border-b px-3 backdrop-blur-sm sm:px-6"
        >
            {chapters.map(({ id, title }) => (
                <a
                    key={id}
                    href={`#${id}`}
                    aria-current={current === id ? "location" : undefined}
                    onClick={(event) => {
                        if (!event.metaKey && !event.ctrlKey && !event.shiftKey && event.button === 0) {
                            event.preventDefault();
                            onNavigate(id);
                        }
                    }}
                    className="hover:bg-faint aria-[current=location]:bg-foreground aria-[current=location]:text-background shrink-0 rounded-full px-4 py-2 text-xs transition-colors focus-visible:outline-2"
                >
                    {title}
                </a>
            ))}
        </nav>
    );
}
