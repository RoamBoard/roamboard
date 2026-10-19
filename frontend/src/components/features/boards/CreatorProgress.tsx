import type { BoardStatus } from "@/types/board-creator";
import BackLink from "@/components/ui/BackLink";

export default function CreatorProgress({
    dirty,
    saved,
    loading,
    saving,
    uploading,
    backHref
}: {
    dirty: boolean;
    saved: boolean;
    loading: boolean;
    saving: BoardStatus | null;
    uploading: boolean;
    backHref?: string;
}) {
    return (
        <div className="border-line bg-background sticky top-0 z-30 flex items-center gap-5 border-b px-4 py-3 sm:gap-8 sm:px-8">
            {backHref ? <BackLink fallbackHref={backHref} className="shrink-0" /> : null}
            <div className="mx-auto flex max-w-[90rem] min-w-0 flex-1 flex-wrap items-center justify-between gap-x-8 gap-y-2">
                <div className="min-w-0 flex-1">
                    <nav aria-label="Board editor chapters" className="min-w-0 flex-1 overflow-x-auto">
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
                </div>
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
