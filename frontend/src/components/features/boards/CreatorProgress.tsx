"use client";
import { useEffect, useState } from "react";
import ChapterBar from "@/components/ui/ChapterBar";
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
    const [current, setCurrent] = useState("board-basics");
    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                const visible = entries.find((entry) => entry.isIntersecting);
                if (visible) setCurrent(visible.target.id);
            },
            { threshold: 0.5 }
        );
        document.querySelectorAll("[data-editor-section]").forEach((section) => observer.observe(section));
        return () => observer.disconnect();
    }, []);
    return (
        <div className="border-line bg-background sticky top-0 z-30 flex items-center gap-5 border-b px-4 sm:gap-8 sm:px-8">
            {backHref ? <BackLink fallbackHref={backHref} className="shrink-0" /> : null}
            <div className="mx-auto flex max-w-[90rem] min-w-0 flex-1 flex-wrap items-center justify-between gap-x-8 gap-y-2">
                <div className="min-w-0 flex-1">
                    <ChapterBar
                        embedded
                        current={current}
                        chapters={[
                            { id: "board-basics", title: "Basics" },
                            { id: "day-plan", title: "Day plan" },
                            { id: "board-map", title: "Map" },
                            { id: "details-discovery", title: "Details" },
                            { id: "board-preview", title: "Overview" }
                        ]}
                        onNavigate={(id) => {
                            setCurrent(id);
                            history.replaceState(history.state, "", `#${id}`);
                            document.getElementById(id)?.focus({ preventScroll: true });
                            window.dispatchEvent(new HashChangeEvent("hashchange"));
                        }}
                    />
                </div>
                <p role="status" className="text-muted-foreground sr-only text-[11px] md:not-sr-only">
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
