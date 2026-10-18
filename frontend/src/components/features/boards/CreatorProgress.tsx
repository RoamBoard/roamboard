import type { BoardStatus } from "@/types/board-creator";

export default function CreatorProgress({
    dirty,
    saved,
    loading,
    saving,
    uploading
}: {
    dirty: boolean;
    saved: boolean;
    loading: boolean;
    saving: BoardStatus | null;
    uploading: boolean;
}) {
    return (
        <div className="border-line bg-background sticky top-0 z-30 border-b px-5 py-3 sm:px-8">
            <div className="mx-auto flex max-w-[90rem] flex-wrap items-center justify-between gap-x-8 gap-y-2">
                <nav aria-label="Board editor chapters" className="min-w-0 overflow-x-auto">
                    <ol className="flex gap-5 text-[11px] whitespace-nowrap sm:gap-7 sm:text-xs">
                        {[
                            ["board-basics", "01 Basics"],
                            ["day-plan", "02 Day plan"],
                            ["board-map", "03 Map"],
                            ["details-discovery", "04 Details"],
                            ["board-preview", "05 Preview"],
                            ["publish", "06 Publish"]
                        ].map(([id, label]) => (
                            <li key={id}>
                                <a
                                    href={`#${id}`}
                                    className="text-muted-foreground hover:text-foreground inline-flex min-h-11 items-center focus-visible:outline-2 focus-visible:outline-offset-[-2px]"
                                >
                                    {label}
                                </a>
                            </li>
                        ))}
                    </ol>
                </nav>
                <p className="text-muted-foreground text-[11px]">
                    {loading
                        ? "Loading Board…"
                        : saving
                          ? "Saving…"
                          : uploading
                            ? "Uploading images…"
                            : dirty
                              ? "Unsaved changes"
                              : saved
                                ? "All changes saved"
                                : "Not saved yet"}
                </p>
            </div>
        </div>
    );
}
